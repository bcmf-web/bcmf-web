-- ============================================================
-- BCMF Flow — Sécurisation complète par Row Level Security
-- À exécuter dans : Supabase > SQL Editor > New query
-- ============================================================

-- ============================================================
-- 1. ACTIVATION DU RLS SUR TOUTES LES TABLES
-- ============================================================
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_teams  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. TABLE: users
-- ============================================================
DROP POLICY IF EXISTS "users_select"       ON users;
DROP POLICY IF EXISTS "users_insert"       ON users;
DROP POLICY IF EXISTS "users_update_own"   ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;

-- Tout utilisateur connecté peut lire les profils (pour afficher les noms)
CREATE POLICY "users_select"
ON users FOR SELECT TO authenticated
USING (true);

-- Inscription : un utilisateur ne peut créer que son propre profil
CREATE POLICY "users_insert"
ON users FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Un utilisateur peut modifier son propre profil
CREATE POLICY "users_update_own"
ON users FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Un admin peut modifier n'importe quel profil
CREATE POLICY "users_update_admin"
ON users FOR UPDATE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- 3. TABLE: events
-- ============================================================
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;

-- Tous les connectés voient tous les événements
CREATE POLICY "events_select"
ON events FOR SELECT TO authenticated
USING (true);

-- Admin et référent peuvent créer un événement
CREATE POLICY "events_insert"
ON events FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'referent')
);

-- Admin ou référent de l'équipe peuvent modifier
CREATE POLICY "events_update"
ON events FOR UPDATE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  OR (
    (SELECT role FROM users WHERE id = auth.uid()) = 'referent'
    AND team = (SELECT team FROM users WHERE id = auth.uid())
  )
);

-- Admin ou référent de l'équipe peuvent supprimer
CREATE POLICY "events_delete"
ON events FOR DELETE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  OR (
    (SELECT role FROM users WHERE id = auth.uid()) = 'referent'
    AND team = (SELECT team FROM users WHERE id = auth.uid())
  )
);

-- ============================================================
-- 4. TABLE: missions
-- ============================================================
DROP POLICY IF EXISTS "missions_select" ON missions;
DROP POLICY IF EXISTS "missions_insert" ON missions;
DROP POLICY IF EXISTS "missions_update" ON missions;
DROP POLICY IF EXISTS "missions_delete" ON missions;

CREATE POLICY "missions_select"
ON missions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "missions_insert"
ON missions FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'referent')
);

CREATE POLICY "missions_update"
ON missions FOR UPDATE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'referent')
);

CREATE POLICY "missions_delete"
ON missions FOR DELETE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'referent')
);

-- ============================================================
-- 5. TABLE: assignments
-- ============================================================
DROP POLICY IF EXISTS "assignments_select"      ON assignments;
DROP POLICY IF EXISTS "assignments_insert"      ON assignments;
DROP POLICY IF EXISTS "assignments_delete_own"  ON assignments;
DROP POLICY IF EXISTS "assignments_delete_admin" ON assignments;

CREATE POLICY "assignments_select"
ON assignments FOR SELECT TO authenticated
USING (true);

-- Seul un bénévole validé peut s'inscrire
CREATE POLICY "assignments_insert"
ON assignments FOR INSERT TO authenticated
WITH CHECK (
  (SELECT status FROM users WHERE id = auth.uid()) = 'approved'
);

-- Un bénévole peut se désinscrire lui-même
CREATE POLICY "assignments_delete_own"
ON assignments FOR DELETE TO authenticated
USING (
  user_name = (SELECT name FROM users WHERE id = auth.uid())
);

-- Admin et référent peuvent supprimer n'importe quelle inscription
CREATE POLICY "assignments_delete_admin"
ON assignments FOR DELETE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'referent')
);

-- ============================================================
-- 6. TABLE: teams
-- ============================================================
DROP POLICY IF EXISTS "teams_select" ON teams;
DROP POLICY IF EXISTS "teams_insert" ON teams;
DROP POLICY IF EXISTS "teams_update" ON teams;
DROP POLICY IF EXISTS "teams_delete" ON teams;

CREATE POLICY "teams_select"
ON teams FOR SELECT TO authenticated
USING (true);

CREATE POLICY "teams_insert"
ON teams FOR INSERT TO authenticated
WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "teams_update"
ON teams FOR UPDATE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "teams_delete"
ON teams FOR DELETE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- 7. TABLE: event_teams
-- ============================================================
DROP POLICY IF EXISTS "event_teams_select" ON event_teams;
DROP POLICY IF EXISTS "event_teams_insert" ON event_teams;
DROP POLICY IF EXISTS "event_teams_delete" ON event_teams;

CREATE POLICY "event_teams_select"
ON event_teams FOR SELECT TO authenticated
USING (true);

CREATE POLICY "event_teams_insert"
ON event_teams FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'referent')
);

CREATE POLICY "event_teams_delete"
ON event_teams FOR DELETE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'referent')
);

-- ============================================================
-- 8. TABLE: user_teams
-- ============================================================
DROP POLICY IF EXISTS "user_teams_select" ON user_teams;
DROP POLICY IF EXISTS "user_teams_insert" ON user_teams;
DROP POLICY IF EXISTS "user_teams_delete" ON user_teams;

CREATE POLICY "user_teams_select"
ON user_teams FOR SELECT TO authenticated
USING (true);

CREATE POLICY "user_teams_insert"
ON user_teams FOR INSERT TO authenticated
WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "user_teams_delete"
ON user_teams FOR DELETE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- 9. TABLE: partners
-- ============================================================
DROP POLICY IF EXISTS "partners_select" ON partners;
DROP POLICY IF EXISTS "partners_insert" ON partners;
DROP POLICY IF EXISTS "partners_update" ON partners;
DROP POLICY IF EXISTS "partners_delete" ON partners;

-- Bénévoles : uniquement les partenaires actifs | Admin : tous
CREATE POLICY "partners_select"
ON partners FOR SELECT TO authenticated
USING (
  active = true
  OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "partners_insert"
ON partners FOR INSERT TO authenticated
WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "partners_update"
ON partners FOR UPDATE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "partners_delete"
ON partners FOR DELETE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- 10. TABLE: skills
-- ============================================================
DROP POLICY IF EXISTS "skills_select" ON skills;
DROP POLICY IF EXISTS "skills_insert" ON skills;
DROP POLICY IF EXISTS "skills_update" ON skills;
DROP POLICY IF EXISTS "skills_delete" ON skills;

CREATE POLICY "skills_select"
ON skills FOR SELECT TO authenticated
USING (true);

CREATE POLICY "skills_insert"
ON skills FOR INSERT TO authenticated
WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "skills_update"
ON skills FOR UPDATE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "skills_delete"
ON skills FOR DELETE TO authenticated
USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- 11. STORAGE: partner-logos
-- ============================================================
DROP POLICY IF EXISTS "logos_select" ON storage.objects;
DROP POLICY IF EXISTS "logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "logos_delete" ON storage.objects;

-- Lecture publique des logos
CREATE POLICY "logos_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

-- Seul un admin peut uploader
CREATE POLICY "logos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'partner-logos'
  AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Seul un admin peut supprimer
CREATE POLICY "logos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'partner-logos'
  AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- FIN — Toutes les policies sont en place
-- ============================================================
