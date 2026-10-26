// Supabase Edge Function : facebook-posts
// Renvoie les derniers posts de la Page Facebook du club (lecture seule, publique).
// Secrets requis (supabase secrets set ...) :
//   FB_PAGE_ID    → identifiant de la Page (ex. 61581146454440)
//   FB_PAGE_TOKEN → jeton d'accès de Page (long terme) — ne quitte jamais le serveur

const GRAPH = "https://graph.facebook.com/v21.0";
const CACHE_MS = 10 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cache: { at: number; body: string } | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });

  if (cache && Date.now() - cache.at < CACHE_MS) return json(cache.body);

  const pageId = Deno.env.get("FB_PAGE_ID");
  const token = Deno.env.get("FB_PAGE_TOKEN");
  if (!pageId || !token) return json({ error: "FB_PAGE_ID / FB_PAGE_TOKEN manquants" }, 500);

  try {
    const url = `${GRAPH}/${pageId}/posts?` + new URLSearchParams({
      fields: "message,created_time,permalink_url,full_picture",
      limit: "6",
      access_token: token,
    });
    const resp = await fetch(url);
    const data = await resp.json();
    if (!resp.ok || data.error) {
      // Ne jamais renvoyer le jeton ni le détail brut au navigateur
      console.error("Graph API error", JSON.stringify(data.error ?? data));
      return json({ error: "Facebook indisponible" }, 502);
    }

    const posts = (data.data ?? []).map((p: any) => ({
      id: p.id,
      message: p.message ?? "",
      created_time: p.created_time,
      url: p.permalink_url,
      image: p.full_picture ?? null,
    }));

    const body = JSON.stringify({ posts });
    cache = { at: Date.now(), body };
    return json(body);
  } catch (err) {
    console.error(err);
    return json({ error: "Erreur serveur" }, 500);
  }
});
