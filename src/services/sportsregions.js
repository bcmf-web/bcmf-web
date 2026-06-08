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
      score_us:   pub.score_us,
      score_them: pub.score_them,
      opponent:   pub.opponent,
      team_name:  pub.team_name,
      note:       pub.note,
    },
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };

  return { success: true, album_id: data?.album_id };
}

/** Génère un nom d'album lisible : "BCMF vs Clermont – 08/06/2026" */
function buildAlbumName(pub) {
  const team    = pub.team_name ?? "BCMF";
  const opponent = pub.opponent ?? "Adversaire";
  const date    = pub.created_at
    ? new Date(pub.created_at).toLocaleDateString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
      })
    : "";

  let name = `${team} vs ${opponent}`;
  if (date) name += ` – ${date}`;
  return name;
}
