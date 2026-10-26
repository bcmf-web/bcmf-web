# BCMF Flow (« BCMF Crew »)

Appli web du **Basket Club Montbrison Féminin (BCMF)** pour gérer les bénévoles, les événements, les missions, les partenaires, et publier des contenus (photos, actualités, affiches de match) sur le site du club hébergé par **SportsRegions**.

Le projet est maintenu par Rodolphe May (admin du club), avec l'aide de Claude. Tout est en **français** : interface, messages et commentaires.

---

## 1. Architecture en un coup d'œil

```
Navigateur (React + Vite, PWA « BCMF Crew »)
   │  supabase-js (clé anon)
   ▼
Supabase (projet lvxlewregtqilzraoxkl)
   ├─ Auth  → comptes bénévoles / admins
   ├─ Base Postgres → tables ci-dessous (RLS : rls_policies.sql)
   ├─ Storage → bucket « bcmf-media » (photos, illustrations)
   └─ Edge Functions (Deno) ──► admin.sportsregions.fr (site du club)
                              └► montbrison-forezbasketfeminin.com (WordPress)
Hébergement front : Vercel (déploiement auto à chaque push sur main)
```

| Élément | Où |
|---|---|
| Dépôt GitHub | `bcmf-web/bcmf-web`, branche `main` |
| Copie locale de Rodolphe | `C:\Users\may77373\OneDrive - Viavi Solutions Inc\BCMF\bcmf-flow` (dans OneDrive, voir pièges) |
| Front en ligne | Vercel. Le domaine `montbrison-forezbasketfeminin.com` redirige `/` vers `/lf2-intro.html` (voir `vercel.json`) |
| Site public du club | `bcmf.sportsregions.fr` |
| Admin du site du club | `admin.sportsregions.fr` (site ID **28604**). L'édition d'un article se fait sur `/actualite/edit/{id}` |
| Dashboard Supabase | supabase.com/dashboard, projet `lvxlewregtqilzraoxkl` |

## 2. Front : `src/`

Une seule page React. La navigation se fait par un état `page` dans `src/App.jsx` (pas de routeur).

| Page (`src/pages/`) | Rôle | Accès |
|---|---|---|
| `LoginPage` / `ResetPasswordPage` | Connexion, inscription, mot de passe oublié | tous |
| `DashboardPage` | Accueil : événements et couverture des missions | tous |
| `EventPage` | Détail d'un événement, missions, inscriptions des bénévoles | tous (gestion : admin ou référent de l'équipe) |
| `PartnersPage` | Partenaires du club, par catégorie | tous (édition : admin) |
| `PublicationsPage` | Onglets **Photos** (albums) et **Actualités** (news), avec le bouton « Mettre en ligne » vers SportsRegions | admin / référent |
| `GameDayPage` | Affiches de match, de résultat et de MVP (détourage des joueuses dans le navigateur avec `onnxruntime-web` et le modèle `public/gameday/isnet-q.onnx`), publication sur SportsRegions | admin / référent |
| `AdminUsersPage` | Validation des comptes, rôles, équipes, habilitations, import en masse | admin |
| `AdminConfigPage` | Configuration : équipes, compétences… | admin |
| `AdminStatsPage` | Statistiques de bénévolat, exports PDF/Excel | admin |

- **Rôles** (`users.role`) : `admin`, `referent` (gère les événements de son équipe), `benevole`. Les règles sont dans `src/services/permissions.js`.
- **Statut des comptes** (`users.status`) : `pending`, puis `approved` ou `rejected`, validé par un admin.
- **Services** (`src/services/`) :
  - `supabaseClient.js` : client Supabase
  - `sportsregions.js` : appels à l'Edge Function `sync-sportsregions`. `errorMessage()` remonte le vrai message d'erreur à la place du générique « non-2xx ».
  - `pushNotifications.js` : notifications Web Push
  - `gameday*.js` : rendu des affiches
  - `bulkImportVolunteers.js` : import en masse des bénévoles
- **PWA** : `public/manifest.json` et `public/sw.js` (cache hors ligne).
- **Pages statiques** dans `public/` : `lf2-intro.html` (page d'intro LF2 et vidéo), `rejoindre.html` (intégrable en iframe), `rejoindre-sportsregions.html`.

## 3. Base Supabase

Principales tables :

| Table | Rôle |
|---|---|
| `users` | Profils |
| `teams`, `user_teams` | Équipes et appartenance |
| `skills` | Habilitations |
| `events`, `event_teams` | Événements |
| `missions`, `assignments` | Missions et bénévoles inscrits (`assignments.user_name`) |
| `partners` | Partenaires |
| `publications` | Albums photo : `photos[]`, `team_name`, `synced` |
| `news` | Actualités : `titre`, `chapo`, `corps`, `team_name`, `illustration_url`, `published_by`, `synced` |
| `push_subscriptions` | Abonnements aux notifications push |

Le champ `synced = true` signifie « déjà publié sur SportsRegions » : le bouton « Mettre en ligne » disparaît et laisse place à « ✅ En ligne ».

Fichiers SQL : `rls_policies.sql` (politiques RLS), `supabase/notify_upcoming_missions_setup.sql` (RPC `get_upcoming_missions_24h` et cron des rappels 24 h avant).

## 4. Edge Functions : `supabase/functions/`

| Fonction | Rôle | Secrets |
|---|---|---|
| `sync-sportsregions` | **Publication sur le site du club.** `action: "news"` crée une actualité. Sans `action`, publie un album photo de l'équipe pour la saison. | `SR_EMAIL`, `SR_PASSWORD` |
| `add-partners` | Récupère les partenaires sur le site WordPress du club et les ajoute sur SportsRegions | `SR_EMAIL`, `SR_PASSWORD` |
| `bulk-add-volunteers` | Crée des comptes bénévoles en masse (réservé aux admins, contrôle du JWT) | `SUPABASE_SERVICE_ROLE_KEY` |
| `send-push` | Envoie des notifications Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `notify-upcoming-missions` | Rappel 24 h avant une mission (appelée par un cron `pg_net`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_*` |

Les secrets se règlent dans Dashboard Supabase → Edge Functions → Secrets. Ne jamais les écrire dans le code.

## 5. Intégration SportsRegions (`sync-sportsregions`)

SportsRegions **n'a pas d'API** : la fonction imite un navigateur sur `admin.sportsregions.fr`.

1. **Connexion** : GET `/login/login_from_admin` (récupère le jeton `CSRF_connect_admin`), puis POST `/login/connect_from_admin`. Les cookies sont collectés à la main (`redirect: "manual"`).
2. **Jetons de formulaire** : `fetchFormTokens()` lit les champs cachés `csrf`/`token` (ou `<meta name="csrf-token">`) de la page du formulaire. Sans eux, le site répond **403**.
3. **Actualité** (`publishNews`) :
   - Étape 1 : POST `/actualite/submit` avec le titre seul et `status=2` (hors ligne), pour obtenir l'ID.
   - Étape 2 : envoi de l'illustration à `https://newsr-api.sportsregions.fr/admin/28604/media/upload` (en-tête `token` = `crypted_id` lu sur la page d'édition).
   - Étape 3 : POST `/actualite/submit/{id}?askforautopublish=1` avec le contenu complet et `status=1` (en ligne).
4. **Albums photo** : un album par équipe et par saison (« Saison 2026-2027 - U11 », la saison démarre en août). `findTeamAlbum`, sinon `createAlbum`, puis `uploadPhotos`.
5. **Équipes → groupe SportsRegions** : table `TEAM_GROUPE_IDS` en haut du fichier. **À compléter à chaque nouvelle équipe.**

**Pièges connus**
- **Faux échec 503 à la mise en ligne** : SportsRegions renvoie parfois une erreur 503 alors que l'article est bien en ligne. Depuis octobre 2026, la fonction relit `/actualite/edit/{id}` et cherche « Statut : en ligne » avant de déclarer un échec (`isNewsOnline`). **Ne jamais relancer automatiquement la mise en ligne**, sous peine de doublon. Pour régulariser un article déjà en ligne, il y a le bouton admin « ✔ Déjà en ligne » dans `PublicationsPage`, qui passe `synced` à `true` sans appeler le site.
- Toute modification du site SportsRegions (noms de champs, jetons) peut casser l'intégration. Il faut alors regarder les messages `jetons: …` dans l'erreur et comparer avec le formulaire réel dans l'admin.

## 6. Déployer

- **Front** : `git push` sur `main`, et Vercel publie automatiquement.
- **Edge Functions** : depuis le PC de Rodolphe, **le CLI Supabase ne fonctionne pas** (le réseau d'entreprise bloque son téléchargement, et la commande `supabase` installée est cassée). On passe donc par le **Dashboard Supabase → Edge Functions → la fonction → onglet Code** : coller le contenu du fichier, puis **Deploy**. Sur une machine où le CLI marche : `supabase functions deploy <nom>`.
- Après un changement de fonction, pousser **aussi** le code sur GitHub, pour que le dépôt reste la référence.

## 7. Pièges de l'environnement

- La copie locale est dans **OneDrive** : Git y est lent et peut bloquer (verrous sur `.git`, questions « Deletion of directory … failed. Should I try again? »). Dans ce cas, répondre `n`.
- La copie locale contient des fichiers **absents de GitHub** : fonction `facebook-posts`, `public/facebook-feed.html`, `public/favicon-bcmf.png`… Les pousser ou les écarter volontairement, mais ne pas les supposer en ligne.
- Le README Vite à la racine est celui du modèle de départ. La doc fonctionnelle historique est dans `src/readme.txt`.

## 8. Conventions

- JavaScript/JSX côté front, TypeScript côté Edge Functions, styles en objets inline (`src/styles/styles.js`), thème vert, blanc et noir (vert principal `#16a34a`, vert foncé `#14532d`).
- Messages et alertes en français, compréhensibles par des bénévoles non techniciens.
- Messages de commit : `fix: …` / `feat: …` en français.
