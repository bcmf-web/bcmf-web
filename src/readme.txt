BCMF FLOW (« BCMF Crew ») - README DEVELOPPEMENT

État au 26/10/2026
Adresse : https://bcmf-web.vercel.app/

Documentation technique détaillée (architecture, fonctions, déploiement, pièges) : CLAUDE.md à la racine du dépôt.
Manuel utilisateur pour les non-initiés : document « BCMF Crew : manuel utilisateur ».

====================================================
OBJECTIF DU PROJET
====================================================

BCMF Crew est l'application web du Basket Club Montbrison Féminin (BCMF). Elle sert à :

* Gérer les bénévoles (inscription, validation, rôles, équipes, habilitations)
* Organiser les événements et leurs missions bénévoles
* Créer les affiches de match (Game Day, Victoire / Défaite, MVP)
* Publier photos et actualités sur le site du club (bcmf.sportsregions.fr)
* Présenter les partenaires du club
* Suivre les statistiques de bénévolat

Les publications du site du club sont ensuite relayées automatiquement sur la Page Facebook
(dépôt séparé bcmf-web/bcmf-facebook).

Technologies :

* React 19 + Vite (front, PWA installable)
* Supabase (Auth, base Postgres, Storage « bcmf-media », Edge Functions)
* Vercel (hébergement, déploiement automatique depuis GitHub)
* onnxruntime-web (détourage des photos dans le navigateur)
* jsPDF / xlsx (exports et imports)

====================================================
RÔLES ET ACCÈS
====================================================

Rôles (users.role) :

* benevole  : voir les événements, s'inscrire aux missions, voir les partenaires
* referent  : + créer et gérer les événements de son équipe, affiches, publications
* admin     : + utilisateurs, équipes et compétences, statistiques, mise en ligne

Statuts de compte (users.status) :

* pending  (en attente de validation)
* approved (validé)
* rejected (refusé)

====================================================
AUTHENTIFICATION ET PROFIL
====================================================

* Connexion par email et mot de passe (Supabase Auth)
* Inscription : prénom, nom, téléphone, email, mot de passe (x2), équipe(s)
  → compte « pending » jusqu'à validation par un admin
* Mot de passe oublié : email de réinitialisation
* Mon profil (clic sur son nom dans le bandeau) : prénom, nom, téléphone modifiables,
  email non modifiable
* Notifications push : bouton cloche « Activer les notifications »

====================================================
ÉVÉNEMENTS ET MISSIONS
====================================================

Événements :

* Types : Match Amateur, Match Pro, Tournoi, Événement club
* Dates de début et de fin, équipes concernées
* Création par un admin ou un référent

Missions :

* Nom, nombre de bénévoles, plage horaire (passage de minuit géré), habilitation requise
* Bénévole : « Je me propose » (avec choix du créneau si la plage est longue),
  « Me désinscrire »
* États : Je me propose / Mission complète / Non habilité
* Admin ou référent : inscrire ou désinscrire un bénévole
* Vue Planning (frise horaire de couverture)
* Exports CSV / PDF de l'événement et du planning
* Rappel push 24 h avant chaque mission (Edge Function notify-upcoming-missions + cron)

====================================================
AFFICHES (Game Day)
====================================================

Trois modèles, dessinés dans le navigateur (canvas) :

* Game Day (avant match, 1600x2000)
* Victoire / Défaite (2 modèles : fond vert + équipe détourée, photo plein fond + panneau vert)
* MVP (carré 1600x1600 : nom, numéro, contexte, 4 statistiques, recadrage de la photo)

Fonctions :

* Détourage automatique de la photo d'équipe (modèle IS-Net, public/gameday/isnet-q.onnx)
  Styles « Détourée » ou « Fondu »
* Retouche manuelle du détourage : Restaurer / Gommer
* Logo adverse : fond blanc retiré automatiquement, ou badge blanc
* Téléchargement JPEG, ou publication directe (album de l'équipe ou actualité)

====================================================
PUBLICATIONS (SportsRegions)
====================================================

Tables : publications (photos), news (actualités). Champ synced = déjà en ligne.

* Photos : équipe, photos, légende facultative → album « Saison AAAA-AAAA - Équipe »
* Actualités : titre, chapô, texte, équipe, illustration
* « Mettre en ligne » (admin) → Edge Function sync-sportsregions
* « ✔ Déjà en ligne » (admin) : marque comme publié sans renvoyer au site
  (cas d'une erreur 503 alors que l'article est bien en ligne)

====================================================
TABLES PRINCIPALES
====================================================

* users, teams, user_teams, skills
* events, event_teams, missions, assignments
* partners
* publications, news
* push_subscriptions

====================================================
PARTENAIRES
====================================================

Table : partners (name, category, description, website, phone, email, logo_url, active)

Catégories : Commerces, Restauration, Industriels, Services, BTP, Loisirs

* Consultation par onglets de catégorie
* Ajout avec logo (2 Mo max), activation / désactivation, suppression
* Import depuis le site WordPress du club (Edge Function add-partners)

====================================================
ADMINISTRATION
====================================================

* Administration utilisateurs : validation, rôle, équipes, habilitations, recherche, filtres
* Import en masse de bénévoles (Excel / CSV : Nom, Prénom, Email, Téléphone, Équipe(s))
  avec mot de passe générique (6 caractères min.)
* Équipes & Compétences : ajout, modification, activation, suppression
* Statistiques & Exports : bénévoles actifs, inscriptions, heures, couverture ;
  vues par bénévole et par événement ; exports CSV / PDF

====================================================
EDGE FUNCTIONS SUPABASE
====================================================

* sync-sportsregions        : publication des actualités et albums sur le site du club
* add-partners              : import des partenaires WordPress vers SportsRegions
* bulk-add-volunteers       : création de comptes en masse (admin)
* send-push                 : envoi de notifications push
* notify-upcoming-missions  : rappels 24 h avant les missions
* facebook-posts            : derniers posts de la Page Facebook (widget public/facebook-feed.html)

====================================================
DÉPLOIEMENT
====================================================

Front :

git add .
git commit -m "message"
git push
→ déploiement automatique GitHub -> Vercel

Edge Functions :

Dashboard Supabase → Edge Functions → la fonction → onglet Code → coller → Deploy
(le CLI Supabase ne fonctionne pas depuis le PC du club / réseau d'entreprise)

====================================================
VERSIONS
====================================================

v0.1-beta

* Base applicative

v0.1.1-beta

* Refonte visuelle BCMF

v0.1.2-beta

* Nouveau processus d'inscription

v0.2.0-beta

* Gestion partenaires
* Profil utilisateur
* Popup administration utilisateurs
* Catégories partenaires

Depuis (jusqu'à octobre 2026)

* Rôle référent
* Créneaux de mission, vue Planning, exports CSV / PDF
* Équipes et compétences en base (page de configuration)
* Notifications push et rappels 24 h avant les missions
* Import en masse des bénévoles
* Statistiques & Exports
* Publications photos et actualités vers SportsRegions
* Affiches Game Day, Victoire / Défaite, MVP avec détourage automatique
* Relais automatique vers Facebook (dépôt bcmf-facebook) et widget des posts Facebook
* Correction du faux échec 503 à la mise en ligne + bouton « Déjà en ligne »

====================================================
ROADMAP (à confirmer)
====================================================

* Calendrier bénévoles
* Partenaires Premium
* Recherche partenaire
* Historique des connexions
* Application mobile native
