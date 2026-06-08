// Supabase Edge Function : sync-sportsregions
// Publie un album photo sur admin.sportsregions.fr
// Variables d'environnement requises :
//   SR_EMAIL    → identifiant SportsRegions (email)
//   SR_PASSWORD → mot de passe SportsRegions

const SR_BASE = "https://admin.sportsregions.fr";

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

// ── 2. Créer un album ──────────────────────────────────────────────────────
async function createAlbum(cookies: string, name: string): Promise<number> {
  // Récupère la page de l'album pour extraire saison_id courante
  const albumPage = await fetch(`${SR_BASE}/albumphoto/popup_new_albumphoto`, {
    headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
  });
  const albumHtml = await albumPage.text();
  const saisonId = albumHtml.match(/name="saison_id"[^>]*value="(\d+)"/)?.[1]
                ?? albumHtml.match(/<option[^>]*selected[^>]*value="(\d+)"/)?.[1]
                ?? albumHtml.match(/value="(\d+)"[^>]*selected/)?.[1]
                ?? "";

  const resp = await fetch(`${SR_BASE}/albumphoto/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "Referer": `${SR_BASE}/albumphoto`,
      "User-Agent": "Mozilla/5.0",
      "Origin": SR_BASE,
    },
    body: new URLSearchParams({
      nom: name,
      section_id: "",
      dicipline_id: "",
      saison_id: saisonId,
      allGroupeCheck: "",
      submitter: "Enregistrer",
    }).toString(),
    redirect: "manual",  // on intercepte la redirection pour récupérer l'ID
    // Note : PAS de X-Requested-With pour obtenir la redirection vers /edit/{id}
  });

  // Cas 1 : redirection vers /albumphoto/edit/{id}
  const location = resp.headers.get("location") ?? "";
  const matchLoc = location.match(/\/albumphoto\/edit\/(\d+)/);
  if (matchLoc) return parseInt(matchLoc[1], 10);

  // Cas 2 : redirection vers la liste → on récupère l'ID du dernier album créé
  if (location.includes("/albumphoto") || resp.status === 302) {
    const listResp = await fetch(`${SR_BASE}/albumphoto`, {
      headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
    });
    const listHtml = await listResp.text();
    // Cherche les liens d'édition : href="/albumphoto/edit/{id}"
    const ids = [...listHtml.matchAll(/albumphoto\/edit\/(\d+)/g)].map(m => parseInt(m[1], 10));
    if (ids.length > 0) return Math.max(...ids); // le plus grand ID = le plus récent
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
): Promise<void> {
  const formData = new FormData();

  for (const url of photoUrls) {
    const photoResp = await fetch(url);
    if (!photoResp.ok) continue;

    const blob = await photoResp.blob();
    const filename = url.split("/").pop()?.split("?")[0] ?? "photo.jpg";
    formData.append("photos[]", blob, filename);
  }

  const uploadResp = await fetch(`${SR_BASE}/albumphoto/submit/${albumId}`, {
    method: "POST",
    headers: {
      "Cookie": cookies,
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `${SR_BASE}/albumphoto/edit/${albumId}`,
    },
    body: formData,
  });

  if (!uploadResp.ok) {
    throw new Error(`Upload photos échoué : HTTP ${uploadResp.status}`);
  }
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

    // 2. Créer l'album
    const albumId = await createAlbum(cookies, album_name);

    // 3. Uploader les photos si présentes
    if (photo_urls?.length > 0) {
      await uploadPhotos(cookies, albumId, photo_urls);
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
      JSON.stringify({ success: true, album_id: albumId }),
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
