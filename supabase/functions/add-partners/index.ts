// Supabase Edge Function : add-partners
// Scrape les partenaires depuis le site WordPress BCMF et les ajoute sur SportsRegions
// Variables d'environnement requises : SR_EMAIL, SR_PASSWORD

const SR_BASE = "https://admin.sportsregions.fr";
const SR_SITE_ID = "28604";
const WP_PARTNERS_URL = "https://www.montbrison-forezbasketfeminin.com/nos-partenaires/";

// ── Helpers cookies ────────────────────────────────────────────────────────
function collectCookies(jar: Record<string, string>, headers: Headers): void {
  const setCookies: string[] = typeof (headers as any).getSetCookie === "function"
    ? (headers as any).getSetCookie()
    : (headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).map((s: string) => s.trim());
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const name  = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name && value && value !== "deleted") jar[name] = value;
  }
}

function jarToString(jar: Record<string, string>): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ── 1. Login SportsRegions ─────────────────────────────────────────────────
async function loginSportsRegions(): Promise<string> {
  const cookieJar: Record<string, string> = {};

  const pageResp = await fetch(`${SR_BASE}/login/login_from_admin`, { redirect: "follow" });
  const html = await pageResp.text();
  collectCookies(cookieJar, pageResp.headers);

  const csrfMatch = html.match(/name="CSRF_connect_admin"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error("CSRF token introuvable sur la page de login");

  const body = new URLSearchParams({
    autologin: "1",
    CSRF_connect_admin: csrfMatch[1],
    identifiant: Deno.env.get("SR_EMAIL") ?? "",
    password:    Deno.env.get("SR_PASSWORD") ?? "",
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
    redirect: "manual",
  });
  collectCookies(cookieJar, loginResp.headers);

  const location = loginResp.headers.get("location");
  if (location) {
    const redirectUrl = location.startsWith("http") ? location : `${SR_BASE}${location}`;
    const redirectResp = await fetch(redirectUrl, {
      headers: { "Cookie": jarToString(cookieJar), "User-Agent": "Mozilla/5.0" },
      redirect: "manual",
    });
    collectCookies(cookieJar, redirectResp.headers);
  }

  if (!cookieJar["session"] && !cookieJar["login_key"]) {
    throw new Error("Échec du login SportsRegions — vérifiez SR_EMAIL et SR_PASSWORD");
  }
  return jarToString(cookieJar);
}

// ── 2. Récupérer le crypted_id depuis la page partenaire ───────────────────
async function getCryptedId(cookies: string): Promise<string> {
  const resp = await fetch(`${SR_BASE}/partenaire`, {
    headers: { "Cookie": cookies, "User-Agent": "Mozilla/5.0" },
  });
  const html = await resp.text();
  const match = html.match(/var\s+crypted_id\s*=\s*['"]([a-f0-9]+)['"]/);
  if (!match) throw new Error("crypted_id introuvable sur /partenaire");
  return match[1];
}

// ── 3. Scraper les partenaires depuis WordPress ────────────────────────────
interface Partner {
  nom: string;
  lien: string;
  logoUrl: string;
}

async function scrapePartners(): Promise<{ partners: Partner[]; debugHtml?: string }> {
  const resp = await fetch(WP_PARTNERS_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resp.ok) throw new Error(`Scraping WordPress échoué (HTTP ${resp.status})`);
  const html = await resp.text();

  const partners: Partner[] = [];

  // Strategy 1 : chercher <a href="...external..."><img src="..." alt="NOM"/></a>
  // Le HTML WordPress est potentiellement sur une seule ligne, donc on cherche a>img
  const linkImgPattern = /<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>(?:[^<]*<[^/][^>]*>)*[^<]*<img\s[^>]*src="(https?:\/\/[^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>[^<]*(?:<\/[^>]+>[^<]*)*<\/a>/gi;

  for (const match of html.matchAll(linkImgPattern)) {
    const href = match[1] ?? "";
    const src  = match[2] ?? "";
    const alt  = match[3] ?? "";

    if (!src || !href) continue;
    // Ignore liens internes BCMF
    if (href.includes("montbrison-forez") || href.includes("bcmf")) continue;
    // Ignore images BCMF (logo du club, etc.)
    if (src.includes("bcmf") || alt.toLowerCase().includes("bcmf")) continue;

    const nom = alt.trim() || href.replace(/https?:\/\/(www\.)?/, "").split("/")[0];
    if (!nom) continue;

    partners.push({ nom, lien: href, logoUrl: src });
  }

  // Strategy 2 (fallback) : img avec src externe + attribut data-link ou parent <a>
  if (partners.length === 0) {
    // Cherche toutes les images avec URL externe + leur balise <a> parente
    const imgPattern = /<img\s[^>]*src="(https?:\/\/(?:www\.)?montbrison[^"]+\/wp-content\/uploads\/[^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi;
    for (const match of html.matchAll(imgPattern)) {
      const src = match[1] ?? "";
      const alt = match[2] ?? "";
      if (!src) continue;
      // Chercher le <a> parent dans le contexte (100 chars avant)
      const idx  = match.index ?? 0;
      const ctx  = html.slice(Math.max(0, idx - 200), idx);
      const aTag = ctx.match(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>(?!.*<\/a>)/i);
      const lien = aTag?.[1] ?? "";
      const nom  = alt.trim() || (lien ? lien.replace(/https?:\/\/(www\.)?/, "").split("/")[0] : "");
      if (!nom || !src) continue;
      if (lien.includes("montbrison-forez")) continue;
      partners.push({ nom, lien, logoUrl: src });
    }
  }

  // Debug snippet (500 premiers chars autour du 1er logo)
  const firstImgIdx = html.search(/<img[^>]+wp-content\/uploads/i);
  const debugHtml = firstImgIdx >= 0
    ? html.slice(Math.max(0, firstImgIdx - 200), firstImgIdx + 300)
    : html.slice(0, 500);

  return { partners, debugHtml };
}

// ── 4. Uploader un logo vers SportsRegions ─────────────────────────────────
interface UploadResult {
  temp_filename: string;
  original_filename: string;
  uid: string;
  filesize: number;
}

async function uploadLogo(cryptedId: string, logoUrl: string): Promise<UploadResult> {
  const logoResp = await fetch(logoUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!logoResp.ok) throw new Error(`Logo fetch failed (HTTP ${logoResp.status}): ${logoUrl}`);
  const blob = await logoResp.blob();
  const filename = logoUrl.split("/").pop()?.split("?")[0] ?? "logo.png";

  const fd = new FormData();
  fd.append("Filedata", blob, filename);

  const uploadResp = await fetch(`https://newsr-api.sportsregions.fr/admin/${SR_SITE_ID}/media/upload`, {
    method: "POST",
    headers: { appversion: "5", token: cryptedId },
    body: fd,
  });

  if (!uploadResp.ok) {
    const errText = await uploadResp.text().catch(() => "");
    throw new Error(`Upload logo échoué (HTTP ${uploadResp.status}): ${errText.slice(0, 200)}`);
  }

  const json = await uploadResp.json();
  if (json.response?.code !== 200) throw new Error(`Upload refusé: ${JSON.stringify(json).slice(0, 200)}`);

  return json.response as UploadResult;
}

// ── 5. Enregistrer un partenaire ───────────────────────────────────────────
async function savePartner(cookies: string, partner: Partner, upload: UploadResult): Promise<void> {
  const params = new URLSearchParams({
    nom:          partner.nom,
    lien:         partner.lien,
    description:  "",
    illustration: upload.uid,
    "image_path[illustration]":      upload.temp_filename,
    "original_filename[illustration]": upload.original_filename,
    "filesize[illustration]":        String(upload.filesize),
    section_id:   "",
    discipline_id: "",
    principal:    "0",
    status:       "1",   // En ligne directement
  });

  const resp = await fetch(`${SR_BASE}/partenaire/newsave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "Referer": `${SR_BASE}/partenaire`,
      "User-Agent": "Mozilla/5.0",
      "Origin": SR_BASE,
    },
    body: params.toString(),
    redirect: "manual",
  });

  // Succès = redirection 302 vers /partenaire?status=1&m=Partenaire+enregistré...
  if (resp.status !== 302 && resp.status !== 0 && resp.status >= 400) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Sauvegarde échouée (HTTP ${resp.status}): ${body.slice(0, 200)}`);
  }
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

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean    = body.dry_run   ?? false;
    const startFrom: number  = body.start_from ?? 0;
    const limitTo: number    = body.limit       ?? 999;

    let partners: Partner[];

    if (Array.isArray(body.partners) && body.partners.length > 0) {
      // Liste fournie directement dans le body — pas besoin de scraper
      partners = body.partners as Partner[];
      console.log(`${partners.length} partenaires fournis directement`);
    } else {
      // Scraper WordPress
      console.log("Scraping WordPress…");
      const { partners: allPartners, debugHtml } = await scrapePartners();
      console.log(`${allPartners.length} partenaires trouvés`);

      if (dryRun) {
        return new Response(
          JSON.stringify({ partners: allPartners, total: allPartners.length, debugHtml }),
          { headers: corsHeaders }
        );
      }
      partners = allPartners;
    }

    // Appliquer les filtres start_from / limit
    partners = partners.slice(startFrom, startFrom + limitTo);

    // 2. Login
    console.log("Login SportsRegions…");
    const cookies   = await loginSportsRegions();
    const cryptedId = await getCryptedId(cookies);
    console.log(`crypted_id: ${cryptedId.slice(0, 8)}…`);

    // 3. Ajouter chaque partenaire
    const results: Array<{ nom: string; status: "ok" | "error"; error?: string }> = [];

    for (const partner of partners) {
      try {
        console.log(`Ajout: ${partner.nom}`);
        const upload = await uploadLogo(cryptedId, partner.logoUrl);
        await savePartner(cookies, partner, upload);
        results.push({ nom: partner.nom, status: "ok" });
        // Petite pause pour ne pas surcharger
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`Erreur ${partner.nom}: ${(err as Error).message}`);
        results.push({ nom: partner.nom, status: "error", error: (err as Error).message });
      }
    }

    const ok    = results.filter(r => r.status === "ok").length;
    const errors = results.filter(r => r.status === "error").length;

    return new Response(
      JSON.stringify({ success: true, added: ok, errors, results }),
      { headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
