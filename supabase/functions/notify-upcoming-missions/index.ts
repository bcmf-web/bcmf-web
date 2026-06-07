import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import webpush from "npm:web-push@3.6.7";

serve(async (req) => {
  // Accepter GET (cron pg_net) et POST
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Missions démarrant dans 23h30 → 24h30 (fenêtre 1h, cron toutes les heures = 1 seule notif)
    const { data: rows, error } = await supabase.rpc("get_upcoming_missions_24h");

    if (error) {
      console.error("Erreur SQL:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!rows || rows.length === 0) {
      console.log("Aucune mission dans les 24h.");
      return new Response(JSON.stringify({ sent: 0 }));
    }

    console.log(`${rows.length} mission(s) à notifier`);

    let sent = 0;
    const expired: string[] = [];

    for (const row of rows) {
      // Récupérer l'abonnement push du bénévole
      const { data: subRow } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", row.user_id)
        .single();

      if (!subRow?.subscription) continue;

      const timeStr = row.time_start ? row.time_start.slice(0, 5) : null;
      const body = timeStr
        ? `📅 ${row.event_title} — Mission "${row.mission_name}" à ${timeStr}`
        : `📅 ${row.event_title} — Mission "${row.mission_name}"`;

      const payload = JSON.stringify({
        title: "⏰ Rappel mission dans 24h !",
        body,
        url: "/",
      });

      try {
        await webpush.sendNotification(subRow.subscription, payload);
        sent++;
        console.log(`✅ Notif envoyée à ${row.user_name} pour "${row.mission_name}"`);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(row.user_id);
        } else {
          console.error(`❌ Erreur pour ${row.user_name}:`, err.statusCode);
        }
      }
    }

    // Nettoyer les abonnements expirés
    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("user_id", expired);
    }

    return new Response(JSON.stringify({ sent, expired_cleaned: expired.length }));
  } catch (e: any) {
    console.error("Erreur générale:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
