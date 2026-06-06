import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log("🔵 REQUÊTE REÇUE:", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📨 send-push invoqué");

    const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    console.log("VAPID subject:", vapidSubject);
    console.log("VAPID public key présente:", !!vapidPublic);

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    console.log("✅ VAPID configuré");

    const { user_ids, title, body, url } = await req.json();
    console.log("Payload reçu:", { user_ids, title, body });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupérer les abonnements
    let query = supabase.from("push_subscriptions").select("subscription, user_id");
    if (user_ids && user_ids.length > 0) {
      query = query.in("user_id", user_ids);
    }
    const { data: subs, error: dbError } = await query;

    console.log("Abonnements trouvés:", subs?.length ?? 0, "| dbError:", dbError?.message);
    if (dbError) throw dbError;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "Aucun abonné" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url: url || "/" });
    let sent = 0;
    const errors: string[] = [];
    const expired: string[] = [];

    for (const row of subs) {
      try {
        console.log("Envoi vers:", row.subscription?.endpoint?.slice(0, 50));
        await webpush.sendNotification(row.subscription, payload);
        sent++;
        console.log("✅ Envoyé !");
      } catch (err: any) {
        console.error("❌ Erreur envoi:", err.statusCode, err.body);
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Abonnement expiré → supprimer
          expired.push(row.user_id);
        } else {
          errors.push(`${err.statusCode}: ${err.body}`);
        }
      }
    }

    // Nettoyer les abonnements expirés
    if (expired.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("user_id", expired);
    }

    return new Response(
      JSON.stringify({ sent, errors, expired_cleaned: expired.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
