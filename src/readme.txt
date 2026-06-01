BCMF FLOW - README DEVELOPPEMENT

Version actuelle : v0.2.0-beta

====================================================
OBJECTIF DU PROJET
==================

BCMF Flow est une application web destinée au BCMF afin de gérer :

* Les bénévoles
* Les événements
* Les missions
* Les habilitations
* Les partenaires du club

Technologies utilisées :

* React
* Vite
* Supabase
* Vercel

====================================================
AUTHENTIFICATION
================

Connexion via Supabase Auth.

Fonctionnalités :

* Connexion
* Déconnexion
* Création de compte
* Validation des bénévoles par un administrateur

Formulaire d'inscription :

* Prénom
* Nom
* Téléphone
* Email
* Mot de passe
* Confirmation mot de passe

Contrôles :

* Champs obligatoires
* Vérification correspondance mot de passe

====================================================
TABLE USERS
===========

Table : users

Colonnes principales :

* id
* email
* first_name
* last_name
* name
* phone
* role
* team
* status
* skills

Roles :

* admin
* benevole

Status :

* pending
* approved
* rejected

====================================================
GESTION DES UTILISATEURS
========================

Page : Admin Users

Fonctionnalités :

* Liste des utilisateurs
* Validation / refus
* Attribution des rôles
* Affectation des équipes
* Gestion des habilitations

Interface :

* Fenêtre popup "Modifier utilisateur"
* Informations personnelles en lecture seule
* Gestion club modifiable

Informations affichées :

* Nom
* Email
* Téléphone
* Statut
* Rôle
* Équipe
* Habilitations

====================================================
MON PROFIL
==========

Accessible en cliquant sur le nom de l'utilisateur dans le bandeau supérieur.

Informations modifiables :

* Prénom
* Nom
* Téléphone

Informations non modifiables :

* Email

Après enregistrement :

* Mise à jour Supabase
* Relecture du profil
* Rafraîchissement immédiat du bandeau

====================================================
GESTION DES EVENEMENTS
======================

Fonctionnalités existantes :

* Liste des événements
* Couverture des missions
* Participation bénévole
* Dashboard principal

A améliorer :

* Gestion avancée des équipes
* Calendrier
* Export

====================================================
PARTENAIRES
===========

Table : partners

Colonnes :

* id
* name
* category
* description
* website
* phone
* email
* logo_url
* active

Catégories :

* Commerces
* Restauration
* Industriels
* BTP
* Loisirs

Fonctionnalités :

* Consultation partenaires
* Ajout partenaire
* Activation / désactivation
* Suppression partenaire

Affichage :

* Onglets par catégorie

====================================================
INTERFACE
=========

Thème BCMF :

* Vert
* Blanc
* Noir

Améliorations réalisées :

* Popup inscription moderne
* Popup administration utilisateurs
* Popup profil utilisateur
* Navigation partenaires

====================================================
DEPLOIEMENT
===========

GitHub

Commande :

git add .
git commit -m "message"
git push

Déploiement automatique :

GitHub -> Vercel

====================================================
VERSIONS
========

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

====================================================
ROADMAP
=======

Priorité haute :

* Upload logo partenaires
* Teams dynamiques en base
* Skills dynamiques en base
* Responsive mobile

Priorité moyenne :

* Partenaires Premium
* Recherche partenaire
* Historique connexions
* Gestion mot de passe

Long terme :

* Application mobile
* Notifications
* Calendrier bénévoles
* Statistiques bénévolat
