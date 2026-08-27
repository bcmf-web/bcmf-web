// Supabase Edge Function : bulk-add-volunteers
// Crée en masse des comptes bénévoles (auth + profil + équipes) avec un mot de passe générique commun.
// Réservé aux admins — vérifie le rôle de l'appelant via son JWT avant toute création.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VolunteerInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  teams?: string[];
}

interface VolunteerResult {
  name: string;
  email: string;
  status: "ok" | "error";
  generated_login: boolean;
  unmatched_teams?: string[];
  error?: string;
}

// Domaine technique utilisé pour générer un identifiant de connexion quand aucun email réel n'est connu.
const GENERATED_LOGIN_DOMAIN = "bcmf-crew.local";

function normalizeForSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function generateLoginEmail(firstName: string, lastName: string): string {
  const slug = normalizeForSlug(`${firstName}.${lastName}`) || "benevole";
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${slug}.${suffix}@${GENERATED_LOGIN_DOMAIN}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Vérifier que l'appelant est bien un admin approuvé
    const { data: callerAuth, error: callerAuthError } = await admin.auth.getUser(callerToken);
    if (callerAuthError || !callerAuth?.user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: callerProfileError } = await admin
      .from("users")
      .select("role, status")
      .eq("id", callerAuth.user.id)
      .single();

    if (callerProfileError || callerProfile?.role !== "admin" || callerProfile?.status !== "approved") {
      return new Response(JSON.stringify({ error: "Réservé aux administrateurs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const volunteers: VolunteerInput[] = Array.isArray(body.volunteers) ? body.volunteers : [];
    const defaultPassword: string = String(body.default_password ?? "");

    if (defaultPassword.length < 6) {
      return new Response(JSON.stringify({ error: "Le mot de passe générique doit contenir au moins 6 caractères" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (volunteers.length === 0) {
      return new Response(JSON.stringify({ error: "Aucun bénévole fourni" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (volunteers.length > 500) {
      return new Response(JSON.stringify({ error: "Trop de bénévoles en une seule fois (max 500)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allTeams } = await admin.from("teams").select("id, name");
    const teamsByName = new Map((allTeams ?? []).map((t) => [t.name.trim().toLowerCase(), t.id]));

    const results: VolunteerResult[] = [];

    for (const v of volunteers) {
      const providedEmail = (v.email ?? "").trim().toLowerCase();
      const firstName = (v.first_name ?? "").trim();
      const lastName = (v.last_name ?? "").trim();
      const hasRealEmail = providedEmail.length > 0;
      const displayName = `${firstName} ${lastName}`.trim() || "(nom manquant)";

      if (!firstName || !lastName) {
        results.push({ name: displayName, email: providedEmail, status: "error", generated_login: false, error: "Nom ou prénom manquant" });
        continue;
      }

      try {
        const email = hasRealEmail ? providedEmail : generateLoginEmail(firstName, lastName);

        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password: defaultPassword,
          email_confirm: true,
        });

        if (createError || !created?.user) {
          results.push({ name: displayName, email, status: "error", generated_login: !hasRealEmail, error: createError?.message ?? "Création du compte échouée" });
          continue;
        }
        const userId = created.user.id;

        const { error: profileError } = await admin.from("users").insert([{
          id: userId,
          email,
          name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName,
          phone: v.phone ?? null,
          role: "benevole",
          status: "approved",
          skills: [],
        }]);

        if (profileError) {
          await admin.auth.admin.deleteUser(userId);
          results.push({ name: displayName, email, status: "error", generated_login: !hasRealEmail, error: "Profil : " + profileError.message });
          continue;
        }

        const requestedTeams = (v.teams ?? []).map((t) => t.trim()).filter(Boolean);
        const matchedTeamIds: string[] = [];
        const unmatchedTeams: string[] = [];
        for (const teamName of requestedTeams) {
          const teamId = teamsByName.get(teamName.toLowerCase());
          if (teamId) matchedTeamIds.push(teamId);
          else unmatchedTeams.push(teamName);
        }

        if (matchedTeamIds.length > 0) {
          await admin.from("user_teams").insert(
            matchedTeamIds.map((teamId) => ({ user_id: userId, team_id: teamId }))
          );
        }

        results.push({
          name: displayName,
          email,
          status: "ok",
          generated_login: !hasRealEmail,
          unmatched_teams: unmatchedTeams.length > 0 ? unmatchedTeams : undefined,
        });
      } catch (err) {
        results.push({ name: displayName, email: providedEmail, status: "error", generated_login: !hasRealEmail, error: (err as Error).message });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const errors = results.filter((r) => r.status === "error").length;

    return new Response(JSON.stringify({ success: true, added: ok, errors, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
