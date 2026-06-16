// Supabase Edge Function : sync-sportsregions
// Publie un album photo sur admin.sportsregions.fr
// Variables d'environnement requises :
//   SR_EMAIL    → identifiant SportsRegions (email)
//   SR_PASSWORD → mot de passe SportsRegions

const SR_BASE = "https://admin.sportsregions.fr";
const SR_SITE_ID = "28604";

// Mapping équipes → groupe_id SportsRegions
const TEAM_GROUPE_IDS: Record<string, string> = {
  "U7":         "188025",
  "U9":         "188026",
  "U11GP":      "188027",
  "U11PP":      "188028",
  "U13-1":      "188029",
  "U13-2":      "188030",
  "U15-1":      "188031",
  "U15-2":      "188032",
  "U18":        "188033",
  "U18-Elite":  "188034",
  "PNF":        "188035",
  "Loisir":     "188036",
  "DF3":        "188037",
  "LF2":        "188038",
};

// ── 1. Login SportsRegions ─────────────────────────────────────────────────
async function loginSportsRegions(): Promise<string> {
  // Collecte tous les cookies au fil des requêtes
  let cookieJar: Record<string, string> = {};

  // Étape 1 : GET page de login → récupère session initiale + CSRF
  const pageResp = await fetch(`${SR_BASE}/login/login_from_admin`, {
    redirect: "follow",
  });
  const html = await pageResp.text();
  collectCookies(cookieJar, pageResp.headers);

  const csrfMatch = html.match(/name="CSRF_connect_admin"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error("CSRF token introuvable sur la page de login");
  const csrf = csrfMatch[1];

  // Étape 2 : POST login
  const body = new URLSearchParams({
    autologin: "1",
    CSRF_connect_admin: csrf,
    identifiant: Deno.env.get("SR_EMAIL") ?? "",
    password: Deno.env.get("SR_PASSWORD") ?? "",
  });

  const loginResp = await fetch(`${SR_BASE}/login/connect_from_admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": jarToString(cookieJar),
      "Referer": `${SR_BASE}/login/login_from_admin`,
      "User-Agent": "Mozilla/5.0",
    },
    body: body.toString(),
    redirect: "manual", // on gère les redirections manuellement pour capturer les cookies
  });
  collectCookies(cookieJar, loginResp.headers);

  // Étape 3 : suivre la redirection si présente
  const location = loginResp.headers.get("location");
  if (location) {
    const redirectUrl = location.startsWith("http") ? location : `${SR_BASE}${location}`;
    const redirectResp = await fetch(redirectUrl, {
      headers: {
        "Cookie": jarToString(cookieJar),
        "User-Agent": "Mozilla/5.0",
      },
      redirect: "manual",
    });
    collectCookies(cookieJar, redirectResp.headers);
  }

  if (!cookieJar["session"] && !cookieJar["login_key"]) {
    throw new Error("Échec du login SportsRegions — vérifiez SR_EMAIL et SR_PASSWORD");
  }

  return jarToString(cookieJar);
}

// ── Helpers cookies ────────────────────────────────────────────────────────
function collectCookies(jar: Record<string, string>, headers: Headers): void {
  // getSetCookie() retourne un tableau (Deno 1.32+), sinon fallback sur get()
  const setCookies: string[] = typeof (headers as any).getSetCookie === "function"
    ? (headers as any).getSetCookie()
    : (headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).map((s: string) => s.trim());

  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const name  = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name && value && value !== "deleted") {
      jar[name] = value;
    }
  }
}

function jarToString(jar: Record<string, string>): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ── 2a. Chercher l'album existant pour une équipe ─────────────────────────
async function findTeamAlbum(cookies: string, teamName: string): Promise<number | null> {
  // Cherche dans tous les albums (en ligne et hors ligne) un album "Saison * - {teamName}"
  for (const status of [1, 2]) {
    const resp = await fetch(`${SR_BASE}/albumphoto?status=${status}`, {
      headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
    });
    const html = await resp.text();

    // Cherche les blocs album avec leur nom et leur lien d'édition
    const blocks = [...html.matchAll(/albumphoto\/edit\/(\d+)[^>]*>[\s\S]*?<[^>]*class="[^"]*titre[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/gi)];
    for (const block of blocks) {
      const id   = parseInt(block[1], 10);
      const nom  = block[2].replace(/<[^>]+>/g, "").trim();
      if (nom.toLowerCase().includes(teamName.toLowerCase())) return id;
    }

    // Fallback : chercher le nom dans le HTML brut autour de chaque lien edit
    const matches = [...html.matchAll(/albumphoto\/edit\/(\d+)/g)];
    for (const m of matches) {
      const id  = parseInt(m[1], 10);
      const idx = m.index ?? 0;
      const ctx = html.slice(idx, idx + 300);
      if (ctx.toLowerCase().includes(teamName.toLowerCase())) return id;
    }
  }
  return null;
}

// ── 2b. Créer un album ────────────────────────────────────────────────────
async function createAlbum(cookies: string, name: string, teamName?: string): Promise<number> {
  // Récupère la page de l'album pour extraire saison_id courante
  const albumPage = await fetch(`${SR_BASE}/albumphoto/popup_new_albumphoto`, {
    headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
  });
  const albumHtml = await albumPage.text();
  const saisonId = albumHtml.match(/name="saison_id"[^>]*value="(\d+)"/)?.[1]
                ?? albumHtml.match(/<option[^>]*selected[^>]*value="(\d+)"/)?.[1]
                ?? albumHtml.match(/value="(\d+)"[^>]*selected/)?.[1]
                ?? "";

  // Résoudre le groupe_id à partir du nom d'équipe
  const groupeId = teamName ? (TEAM_GROUPE_IDS[teamName] ?? null) : null;

  // Construire le body — si équipe connue : envoyer groupe_id[], sinon cocher "Toutes les équipes"
  const params = new URLSearchParams({
    nom: name,
    section_id: "",
    dicipline_id: "",
    saison_id: saisonId,
    submitter: "Enregistrer",
  });
  if (groupeId) {
    params.append("groupe_id[]", groupeId);
  } else {
    params.append("allGroupeCheck", "");
  }

  const resp = await fetch(`${SR_BASE}/albumphoto/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "Referer": `${SR_BASE}/albumphoto`,
      "User-Agent": "Mozilla/5.0",
      "Origin": SR_BASE,
    },
    body: params.toString(),
    redirect: "manual",
  });

  // Cas 1 : redirection vers /albumphoto/edit/{id}
  const location = resp.headers.get("location") ?? "";
  const matchLoc = location.match(/\/albumphoto\/edit\/(\d+)/);
  if (matchLoc) return parseInt(matchLoc[1], 10);

  // Cas 2 : redirection vers la liste → on trouve le NOUVEL ID (pas dans la liste avant création)
  if (location.includes("/albumphoto") || resp.status === 302) {
    // Snapshot des IDs existants AVANT création
    const beforeResp = await fetch(`${SR_BASE}/albumphoto`, {
      headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
    });
    const beforeHtml = await beforeResp.text();
    const beforeIds = new Set(
      [...beforeHtml.matchAll(/albumphoto\/edit\/(\d+)/g)].map(m => parseInt(m[1], 10))
    );

    // Snapshot APRÈS création
    const afterResp = await fetch(`${SR_BASE}/albumphoto`, {
      headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
    });
    const afterHtml = await afterResp.text();
    const afterIds = [...afterHtml.matchAll(/albumphoto\/edit\/(\d+)/g)].map(m => parseInt(m[1], 10));

    // Le nouvel ID est celui absent de la liste d'avant
    const newId = afterIds.find(id => !beforeIds.has(id));
    if (newId) return newId;

    // Fallback : chercher par nom d'album dans la liste
    if (name) {
      const nameMatch = afterHtml.match(
        new RegExp(`albumphoto/edit/(\\d+)[^]*?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
      );
      if (nameMatch) return parseInt(nameMatch[1], 10);
    }

    // Dernier recours : le plus grand ID
    if (afterIds.length > 0) return Math.max(...afterIds);
  }

  // Cas 3 : réponse JSON
  const text = await resp.text();
  const matchJson = text.match(/"id"\s*:\s*(\d+)/) ?? text.match(/albumphoto\/edit\/(\d+)/);
  if (matchJson) return parseInt(matchJson[1], 10);

  throw new Error(`Création album échouée (HTTP ${resp.status}) — Location: ${location} — ${text.slice(0, 200)}`);
}

// ── 3. Uploader les photos ─────────────────────────────────────────────────
async function uploadPhotos(
  cookies: string,
  albumId: number,
  photoUrls: string[]
): Promise<string[]> {
  const debugLog: string[] = [];
  // 1. Récupérer le crypted_id (token API) depuis la page d'édition de l'album
  const editResp = await fetch(`${SR_BASE}/albumphoto/edit/${albumId}`, {
    headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
  });
  const editHtml = await editResp.text();

  const cryptedId = editHtml.match(/var\s+crypted_id\s*=\s*['"]([a-f0-9]+)['"]/)?.[1]
                 ?? editHtml.match(/crypted_id\s*[:=]\s*['"]([a-f0-9]+)['"]/)?.[1];

  debugLog.push(`editPage HTTP ${editResp.status}, crypted_id: ${cryptedId ? cryptedId.slice(0,8)+'...' : 'INTROUVABLE'}`);
  if (!cryptedId) {
    throw new Error(`crypted_id introuvable sur /albumphoto/edit/${albumId} (HTTP ${editResp.status})`);
  }

  // 2. Uploader chaque photo une par une vers l'API newsr
  const uploadUrl = `https://newsr-api.sportsregions.fr/admin/${SR_SITE_ID}/albums-photos/photos/${albumId}/add`;

  for (const url of photoUrls) {
    const photoResp = await fetch(url);
    debugLog.push(`fetch photo HTTP ${photoResp.status} — ${url.slice(0, 80)}`);
    if (!photoResp.ok) {
      throw new Error(`Impossible de télécharger la photo (HTTP ${photoResp.status}) : ${url}`);
    }

    const blob = await photoResp.blob();
    const filename = url.split("/").pop()?.split("?")[0] ?? "photo.jpg";

    const formData = new FormData();
    formData.append("list_photo_name_files", "");
    formData.append("form-end", "end");
    formData.append("Filedata", blob, filename);

    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Accept": "*/*",
        "appversion": "5",
        "token": cryptedId,
        "Referer": `${SR_BASE}/albumphoto/edit/${albumId}`,
        "Origin": SR_BASE,
      },
      body: formData,
    });

    const uploadBody = await uploadResp.text().catch(() => "");
    debugLog.push(`upload HTTP ${uploadResp.status} → ${uploadBody.slice(0, 150)}`);
    if (!uploadResp.ok) {
      throw new Error(`Upload photo échoué (HTTP ${uploadResp.status}) : ${uploadBody.slice(0, 300)}`);
    }
  }
  return debugLog;
}

// ── 4. Publier une news avec le score ──────────────────────────────────────
async function publishScoreNews(
  cookies: string,
  titre: string,
  contenu: string
): Promise<void> {
  // Récupère la page de création de news pour le CSRF
  const pageResp = await fetch(`${SR_BASE}/actualite`, {
    headers: { "Cookie": cookies },
  });
  const html = await pageResp.text();
  const csrfMatch = html.match(/name="token"\s+value="([^"]+)"/)
                 ?? html.match(/"_token"\s*:\s*"([^"]+)"/);
  const token = csrfMatch?.[1] ?? "";

  const body = new URLSearchParams({
    titre,
    contenu,
    statut: "1",         // En ligne
    en_une: "0",
    ...(token ? { _token: token, token } : {}),
  });

  await fetch(`${SR_BASE}/actualite/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `${SR_BASE}/actualite`,
    },
    body: body.toString(),
    redirect: "manual",
  });
}

// ── Handler principal ──────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { album_name, photo_urls, score_us, score_them, opponent, team_name, note } =
      await req.json();

    if (!album_name) {
      return new Response(JSON.stringify({ error: "album_name requis" }), { status: 400 });
    }

    // 1. Login
    const cookies = await loginSportsRegions();

    // Debug : vérifier que la session est valide
    const checkResp = await fetch(`${SR_BASE}/albumphoto`, {
      headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
      redirect: "manual",
    });
    const checkLocation = checkResp.headers.get("location") ?? "";
    if (checkLocation.includes("login") || checkLocation.includes("espaceperso")) {
      throw new Error(`Session invalide après login (redirect: ${checkLocation}). Vérifiez SR_EMAIL/SR_PASSWORD.`);
    }

    // 2. Trouver l'album existant de l'équipe, ou en créer un nouveau
    let albumId: number;
    if (team_name) {
      const existing = await findTeamAlbum(cookies, team_name);
      albumId = existing ?? await createAlbum(cookies, `Saison 2025-2026 - ${team_name}`, team_name);
    } else {
      albumId = await createAlbum(cookies, album_name, team_name);
    }

    // 3. Uploader les photos si présentes
    let uploadDebug: string[] = [];
    if (photo_urls?.length > 0) {
      uploadDebug = await uploadPhotos(cookies, albumId, photo_urls);
    }

    // 4. Publier news avec le score si fourni
    if (score_us != null && score_them != null && opponent) {
      const result = score_us > score_them ? "✅ Victoire" : score_us === score_them ? "🤝 Match nul" : "❌ Défaite";
      const titre  = `${result} — ${team_name ?? "BCMF"} ${score_us}-${score_them} ${opponent}`;
      const contenu = note
        ? `<p>${titre}</p><p>${note}</p>`
        : `<p>${titre}</p>`;

      await publishScoreNews(cookies, titre, contenu);
    }

    return new Response(
      JSON.stringify({ success: true, album_id: albumId, photos_count: photo_urls?.length ?? 0, debug: uploadDebug }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
