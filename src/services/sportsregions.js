import { supabase } from "./supabaseClient.js";

/**
 * Publie une publication (album photos + score) sur SportsRegions
 * via la Supabase Edge Function "sync-sportsregions".
 *
 * @param {Object} pub - La publication depuis la table publications
 * @returns {{ success: boolean, album_id?: number, error?: string }}
 */
export async function publishToSportsRegions(pub) {
  const { data, error } = await supabase.functions.invoke("sync-sportsregions", {
    body: {
      album_name: buildAlbumName(pub),
      photo_urls: pub.photos ?? [],
      team_name:  pub.team_name,
    },
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };

  return { success: true, album_id: data?.album_id };
}

export async function publishNewsToSportsRegions(news) {
  const { data, error } = await supabase.functions.invoke("sync-sportsregions", {
    body: {
      action:           "news",
      titre:            news.titre,
      chapo:            news.chapo ?? "",
      corps:            news.corps ?? "",
      team_name:        news.team_name ?? null,
      illustration_url: news.illustration_url ?? null,
    },
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };

  return { success: true, news_id: data?.news_id };
}

/** Génère un nom d'album : "U11 – Photos – 10/06/2026" */
function buildAlbumName(pub) {
  const team = pub.team_name ?? "BCMF";
  const date = pub.created_at
    ? new Date(pub.created_at).toLocaleDateString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
      })
    : "";
  return date ? `${team} – Photos – ${date}` : `${team} – Photos`;
}
