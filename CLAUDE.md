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
                              ├► montbrison-forezbasketfeminin.com (WordPress)
                              └► Facebook Graph API (lecture des posts de la Page)
Hébergement front : Vercel (déploiement auto à chaque push sur main)

Dépôt séparé bcmf-web/bcmf-facebook (GitHub Actions, toutes les 30 min) :
   bcmf.sportsregions.fr (RSS actus + albums photo) ──► Page Facebook du club
```

La chaîne de publication complète : **BCMF Crew** (actualité, photos, affiche) → **SportsRegions** (`sync-sportsregions`) → **Facebook** (`bcmf-facebook`, automatiquement, dans les 30 min).

| Élément | Où |
|---|---|
| Dépôt GitHub | `bcmf-web/bcmf-web`, branche `main` |
| Copie locale de Rodolphe | `C:\Users\may77373\OneDrive - Viavi Solutions Inc\BCMF\bcmf-flow` (dans OneDrive, voir pièges) |
| Front en ligne | Vercel. Le domaine `montbrison-forezbasketfeminin.com` redirige `/` vers `/lf2-intro.html` (voir `vercel.json`) |
| Site public du club | `bcmf.sportsregions.fr` |
| Admin du site du club | `admin.sportsregions.fr` (site ID **28604**). L'édition d'un article se fait sur `/actualite/edit/{id}` |
| Dashboard Supabase | supabase.com/dashboard, projet `lvxlewregtqilzraoxkl` |
| Relais Facebook | dépôt `bcmf-web/bcmf-facebook` (voir section 6) |
| Page Facebook du club | `facebook.com/profile.php?id=61581146454440` |

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

### Fonctionnalités en détail

**Événements et missions** (`EventPage`, `components/MissionCard.jsx`, `components/PlanningView.jsx`)
- Un événement contient des missions avec un créneau horaire. Le passage de minuit est géré : si la fin est avant le début, on ajoute 24 h.
- Les bénévoles s'inscrivent à une mission, éventuellement sur une partie seulement du créneau. Un admin peut inscrire un bénévole habilité, avec la liste filtrée selon les `skills`.
- La vue **Planning** affiche une frise horaire avec la couverture réelle de chaque mission, minute par minute.
- Exports CSV et PDF de l'événement et du planning (`utils/exportUtils.js`, avec jsPDF et jspdf-autotable).
- Rappel push 24 h avant chaque mission (`notify-upcoming-missions`). Envoi de notifications push depuis l'appli (`send-push`, `services/pushNotifications.js`).

**Affiches** (`GameDayPage`). Tout est dessiné **dans le navigateur**, sur un canvas. Aucune photo n'est envoyée à un service externe.
- Trois types d'affiche :
  - **🏀 Game Day** (avant match, 1600×2000) : équipe, jour, date, heure, salle, ville, logo adverse, choix du logo placé à gauche (BCMF ou adversaire). Moteur : `services/gamedayRender.js`.
  - **🏆 Victoire / Défaite** : scores BCMF et adversaire, journée ou compétition. Deux modèles : « Fond vert + équipe détourée » ou « Photo plein fond + panneau vert ». Moteur : `services/gamedayPosters.js` (`renderResultPoster`).
  - **⭐ MVP** (carré 1600×1600) : prénom et nom, numéro de maillot, contexte (« Finale »…), jusqu'à 4 statistiques modifiables (PTS, REB, PD, EVAL), recadrage de la photo (zoom, point focal). Moteur : `renderMvpPoster`.
- **Détourage de la photo d'équipe** (`services/gamedayCutout.js`) : modèle IS-Net quantifié (`public/gameday/isnet-q.onnx`, 46 Mo) exécuté par `onnxruntime-web`, dont les fichiers WASM sont chargés depuis le CDN jsdelivr. Deux passes, avec nettoyage du masque : les trous du visage et du torse sont bouchés, les lignes du sol retirées. Deux styles : « Détourée (bords nets) » ou « Fondu (bords adoucis) ». Le résultat est gardé en mémoire pour pouvoir retoucher sans relancer le modèle.
- **Retouche manuelle du détourage** : `components/CutoutEditor.jsx`, pinceau « 🖌️ Restaurer » (rendre une partie coupée) et « 🧽 Gommer » (retirer du fond).
- **Logo adverse** (`prepLogo`) : suppression automatique du fond blanc et recadrage, ou mise dans un badge à fond blanc.
- Ressources graphiques dans `public/gameday/` (`bg.jpg`, `bg-mask.png`, `bcmf-logo.png`). Polices : Barlow Condensed, Kaushan Script et Playfair Display (`@fontsource`).
- **Sortie** : téléchargement en JPEG, ou **publication directe** après envoi dans Storage `bcmf-media`. L'affiche part soit dans l'**album photo** de l'équipe, soit comme **actualité** avec l'affiche en illustration (admin seulement). Le titre est pré-rempli, par exemple « Victoire U11 F : 79 - 53 ». La publication enregistre aussi une ligne dans `publications` ou `news`.

**Publications** (`PublicationsPage`)
- **Photos** : les photos sont envoyées dans Storage puis enregistrées dans `publications`. « Mettre en ligne » les ajoute à l'album de la saison de l'équipe sur SportsRegions.
- **Actualités** : titre, chapô, texte, équipe et illustration. « Mettre en ligne » les publie sur SportsRegions.
- **Qui publie quoi** : les **référents** publient uniquement des **photos et des affiches** (dans un album). Les **actualités** (création, mise en ligne, « Déjà en ligne ») et les suppressions sont **réservées aux admins**. La même règle s'applique côté base (RLS `publications_*` : admin et référent ; `news_*` : admin seul). Dans `GameDayPage`, le choix « Actualité » n'apparaît que pour un admin. « ✔ Déjà en ligne » régularise un article sans le renvoyer au site.

**Bénévoles et administration**
- Inscription libre, puis validation par un admin (`pending` → `approved`). Rôles, équipes et habilitations se gèrent dans `AdminUsersPage`.
- Import en masse de bénévoles depuis un fichier Excel ou CSV (`services/bulkImportVolunteers.js` et la fonction `bulk-add-volunteers`, avec un mot de passe générique commun).
- Partenaires classés par catégorie (Commerces, Restauration, Industriels, BTP, Loisirs), import depuis le site WordPress du club (`add-partners`).
- Statistiques de bénévolat et exports (`AdminStatsPage`).

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
| `facebook-posts` | Renvoie les 6 derniers posts de la Page Facebook (lecture seule, cache de 10 min). Utilisée par `public/facebook-feed.html`, un widget « Actus Facebook » intégrable en iframe. Le jeton ne quitte jamais le serveur. | `FB_PAGE_ID`, `FB_PAGE_TOKEN` |
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

## 6. Relais vers Facebook : dépôt `bcmf-web/bcmf-facebook`

C'est un dépôt **séparé**, sans lien avec Supabase ni Vercel. Il republie automatiquement sur la **Page Facebook du club** ce qui paraît sur `bcmf.sportsregions.fr`. Rien à faire depuis l'appli : publier sur SportsRegions suffit.

- **`sync.py`** (Python, sans dépendance) :
  - Actualités : lues dans le flux RSS `bcmf.sportsregions.fr/rss/news`. Publiées sur Facebook en post texte complet avec le lien.
  - Albums photo : lus dans le HTML de `/photos-du-club` (10 albums par page, 5 pages au maximum). Un **nouvel album** donne un post avec jusqu'à 8 photos et le lien. Des **photos ajoutées** à un album existant donnent un post « 📸 Album : N nouvelles photos ajoutées ».
  - **Équipe exclue : `LF2`.** Rien n'est publié si « LF2 » est dans le titre, ou si LF2 est la **seule** équipe étiquetée. Un contenu LF2 + autres équipes reste publié. Voir `EXCLUDED_TEAM`.
  - Le contenu de plus de 7 jours est ignoré (`MAX_AGE_DAYS`). Au tout premier lancement, l'existant est mémorisé sans rien publier.
- **`state.json`** : mémoire de ce qui a déjà été publié (ID des actus, et URL des photos connues par album). Il est mis à jour et commité **par le bot** (« maj état publications ») après chaque passage. **Ne pas le modifier à la main**, sauf pour forcer ou empêcher une republication.
- **`.github/workflows/sync.yml`** : GitHub Actions, toutes les 30 min (aux minutes 2 et 33), plus un lancement manuel possible (onglet Actions → « BCMF -> Facebook » → Run workflow). Variable `DRY_RUN="0"`, donc publication réelle.
- **Secrets GitHub** (Settings → Secrets → Actions du dépôt) : `FB_PAGE_ID`, `FB_PAGE_TOKEN`. Les mêmes valeurs servent pour la fonction Supabase `facebook-posts`.
- **`check_token.py`** : vérifie le jeton de Page sans rien publier. Il doit être de type PAGE, sans expiration, avec les permissions `pages_manage_posts` et `pages_read_engagement`. L'option `--test-post` crée un brouillon puis le supprime.

**Si Facebook ne publie plus** : regarder l'onglet **Actions** du dépôt. Une erreur `Facebook 190`, par exemple, signifie un jeton expiré ou révoqué : il faut générer un nouveau jeton de Page longue durée, mettre à jour le secret GitHub **et** le secret Supabase, puis vérifier avec `check_token.py`. Si SportsRegions change le HTML de `/photos-du-club`, les expressions régulières de `fetch_albums()` et `album_photos()` sont à revoir.

## 7. Déployer

- **Front** : `git push` sur `main`, et Vercel publie automatiquement.
- **Edge Functions** : depuis le PC de Rodolphe, **le CLI Supabase ne fonctionne pas** (le réseau d'entreprise bloque son téléchargement, et la commande `supabase` installée est cassée). On passe donc par le **Dashboard Supabase → Edge Functions → la fonction → onglet Code** : coller le contenu du fichier, puis **Deploy**. Sur une machine où le CLI marche : `supabase functions deploy <nom>`.
- Après un changement de fonction, pousser **aussi** le code sur GitHub, pour que le dépôt reste la référence.

## 8. Pièges de l'environnement

- La copie locale est dans **OneDrive** : Git y est lent et peut bloquer (verrous sur `.git`, questions « Deletion of directory … failed. Should I try again? »). Dans ce cas, répondre `n`.
- La copie locale peut contenir des fichiers **absents de GitHub** (par exemple `public/favicon-bcmf.png`). Vérifier avant de supposer qu'un fichier est sauvegardé ou en ligne.
- Le README Vite à la racine est celui du modèle de départ. La doc fonctionnelle historique est dans `src/readme.txt`.

## 9. Conventions

- JavaScript/JSX côté front, TypeScript côté Edge Functions, styles en objets inline (`src/styles/styles.js`), thème vert, blanc et noir (vert principal `#16a34a`, vert foncé `#14532d`).
- Messages et alertes en français, compréhensibles par des bénévoles non techniciens.
- Messages de commit : `fix: …` / `feat: …` en français.
