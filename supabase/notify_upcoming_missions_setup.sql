-- ============================================================
-- BCMF Flow — Notifications 24h avant une mission
-- À exécuter dans SQL Editor Supabase
-- ============================================================

-- Fonction RPC : missions démarrant dans 23h30 → 24h30
CREATE OR REPLACE FUNCTION get_upcoming_missions_24h()
RETURNS TABLE (
  user_id      uuid,
  user_name    text,
  mission_id   bigint,
  mission_name text,
  time_start   text,
  event_title  text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    u.id, a.user_name, m.id, m.name, m.time_start::text, e.title
  FROM assignments a
  JOIN missions m ON m.id = a.mission_id
  JOIN events   e ON e.id = m.event_id
  JOIN users    u ON u.name = a.user_name
  WHERE
    m.time_start IS NOT NULL
    AND e.start_datetime IS NOT NULL
    AND u.status = 'approved'
    AND (e.start_datetime::date + m.time_start::time)
        BETWEEN (NOW() + INTERVAL '23 hours 30 minutes')
            AND (NOW() + INTERVAL '24 hours 30 minutes');
$$;
