-- ============================================================
-- BCMF Flow — Notifications 24h avant une mission
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Fonction RPC : retourne les bénévoles inscrits sur une mission
--    démarrant entre NOW+23h30 et NOW+24h30
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_upcoming_missions_24h()
RETURNS TABLE (
  user_id     uuid,
  user_name   text,
  mission_id  uuid,
  mission_name text,
  time_start  text,
  event_title text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    u.id          AS user_id,
    a.user_name,
    m.id          AS mission_id,
    m.name        AS mission_name,
    m.time_start::text,
    e.title       AS event_title
  FROM assignments a
  JOIN missions  m ON a.mission_id = m.event_id -- remplacé ci-dessous
  JOIN missions  m2 ON m2.id = a.mission_id
  JOIN events    e  ON m2.event_id = e.id
  JOIN users     u  ON u.name = a.user_name
  WHERE
    m2.time_start IS NOT NULL
    AND e.start_datetime IS NOT NULL
    AND u.status = 'approved'
    AND (
      (e.start_datetime::date + m2.time_start::time)
      BETWEEN (NOW() + INTERVAL '23 hours 30 minutes')
          AND (NOW() + INTERVAL '24 hours 30 minutes')
    );
$$;

-- Correction : la jointure ci-dessus avait une erreur, voici la version propre
CREATE OR REPLACE FUNCTION get_upcoming_missions_24h()
RETURNS TABLE (
  user_id      uuid,
  user_name    text,
  mission_id   uuid,
  mission_name text,
  time_start   text,
  event_title  text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    u.id           AS user_id,
    a.user_name,
    m.id           AS mission_id,
    m.name         AS mission_name,
    m.time_start::text,
    e.title        AS event_title
  FROM assignments a
  JOIN missions m ON m.id = a.mission_id
  JOIN events   e ON e.id = m.event_id
  JOIN users    u ON u.name = a.user_name
  WHERE
    m.time_start IS NOT NULL
    AND e.start_datetime IS NOT NULL
    AND u.status = 'approved'
    AND (
      (e.start_datetime::date + m.time_start::time)
      BETWEEN (NOW() + INTERVAL '23 hours 30 minutes')
          AND (NOW() + INTERVAL '24 hours 30 minutes')
    );
$$;


-- ============================================================
-- 2. Cron job : appelle la fonction toutes les heures
--    (nécessite l'extension pg_cron + pg_net activées dans Supabase)
-- ------------------------------------------------------------
-- Activer les extensions si ce n'est pas déjà fait :
--   Dashboard → Database → Extensions → pg_cron + pg_net

SELECT cron.schedule(
  'notify-upcoming-missions',   -- nom du job (unique)
  '0 * * * *',                  -- toutes les heures pile
  $$
    SELECT net.http_post(
      url     := 'https://lvxlewregtqilzraoxkl.supabase.co/functions/v1/notify-upcoming-missions',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ⚠️  Remplacer le Bearer par votre clé service_role si current_setting ne fonctionne pas :
--   'Bearer eyJhbGci...'   (disponible dans Supabase → Settings → API)

-- Pour vérifier les jobs planifiés :
-- SELECT * FROM cron.job;

-- Pour supprimer le job :
-- SELECT cron.unschedule('notify-upcoming-missions');
