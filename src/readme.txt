# BCMF FLOW

## Présentation

BCMF Flow est une application web destinée à la gestion des bénévoles et des missions du club BCMF.

L'application permet :

* La création de comptes bénévoles
* La gestion des rôles utilisateurs
* La validation des nouveaux comptes
* L'affectation d'habilitations
* La création et le suivi des événements
* La gestion des missions bénévoles
* Le suivi de la couverture des événements

---

# Architecture générale

## Frontend

Technologies utilisées :

* React
* Vite
* JavaScript
* Vercel (hébergement)

Structure :

```text
src/
├── components/
│   └── Header.jsx
│
├── pages/
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── EventPage.jsx
│   └── AdminUsersPage.jsx
│
├── services/
│   └── supabaseClient.js
│
├── styles/
│   └── styles.js
│
├── data/
│   └── InitialData.js
│
└── App.jsx
```

---

# Backend

Le backend repose sur Supabase :

* Authentification
* Base PostgreSQL
* Gestion des droits
* Hébergement des données

---

# Gestion des utilisateurs

## Authentification

Les utilisateurs créent un compte via :

* Email
* Mot de passe

Supabase gère :

* Connexion
* Déconnexion
* Confirmation email
* Sessions

---

## Profils utilisateurs

Les profils sont stockés dans la table :

```text
users
```

Structure actuelle :

```text
id
email
name
role
team
status
skills
created_at
```

---

## Rôles

### benevole

Utilisateur standard.

Peut :

* Voir les événements
* S'inscrire aux missions

### referent

Responsable d'équipe.

Peut :

* Gérer les événements de son équipe

### admin

Administrateur du club.

Peut :

* Gérer les utilisateurs
* Modifier les rôles
* Modifier les équipes
* Modifier les habilitations
* Valider les comptes

---

## Statuts

### pending

Compte en attente de validation.

### approved

Compte validé.

### rejected

Compte refusé.

---

# Gestion des événements

Les événements sont stockés dans Supabase.

Chaque événement contient :

```text
Nom
Date
Equipe
Description
```

---

# Gestion des missions

Chaque événement possède plusieurs missions.

Exemples :

* Buvette
* Table de marque
* Accueil
* Installation
* Rangement

Une mission contient :

```text
Nom
Nombre de bénévoles nécessaires
Habilitation requise
```

---

# Administration

Page :

```text
Administration utilisateurs
```

Fonctions :

* Recherche
* Filtrage
* Modification des rôles
* Modification des équipes
* Modification des habilitations
* Validation des comptes

---

# Déploiement

## Développement local

```bash
npm install
npm run dev
```

---

## Build

```bash
npm run build
```

---

## Déploiement Vercel

Chaque push sur la branche :

```text
main
```

déclenche automatiquement un déploiement sur Vercel.

---

# Evolutions prévues

## Court terme

* Table Teams dans Supabase
* Table Skills dans Supabase
* Déconnexion utilisateur
* Amélioration UX

## Moyen terme

* Modèles de missions
* Statistiques bénévoles
* Notifications email
* Tableau de bord avancé

## Long terme

* Application mobile
* QR Code présence
* Gestion des formations
* Gestion documentaire
* Signature électronique

---

# Historique

## v0.1-beta

Première version opérationnelle :

* Authentification Supabase
* Gestion utilisateurs
* Gestion rôles
* Gestion habilitations
* Gestion événements
* Gestion missions
* Déploiement Vercel
* Administration des utilisateurs
