# Configuration du site Front

**Ce fichier ne contient JAMAIS de valeur réelle** : uniquement des références `.env` (les valeurs vivent dans
`.env`, non commité — voir `.env.example`). Il peut donc être commité.

---

- **URL principale** : _(voir `.env`, variable `RECETTE_URL`)_
- **URL de connexion** : _(voir `.env`, variable `RECETTE_LOGIN_URL`)_ — optionnel : uniquement si l'accès
  exige une authentification préalable sur un portail de connexion avant d'atteindre l'URL principale. Laisser
  la variable vide pour un Front anonyme.

> L'hôte de l'URL principale doit correspondre à un motif autorisé (`RECETTE_ALLOWED_HOST_PATTERNS`, défaut
> `preprod,pp-`) — protection contre tout test accidentel en production.
> ⚠️ Exception : « URL de connexion » n'est **pas** soumise à cette vérification (le portail de connexion d'un
> tiers n'a pas forcément ce type de nom de domaine) — vérifier soi-même qu'il s'agit bien d'un environnement
> de test avant de renseigner cette variable.

## Fonctionnalités du projet

Indicateurs descriptifs (documentation pour les parcours et les scénarios conditionnels — non lus par le code).

| Flag | Valeur | Notes |
|------|--------|-------|
| connexion | non | Site public, aucune authentification |
| filtres-categorie | oui | Parcours, chemins boueux, chemins inondables, danger, autres |
| filtres-distance | oui | Uniquement pour les parcours ; cases « moins de 8 km », « 8 à 10 km », « 10 km et plus », « inconnue » |
| position-gps | oui | Bouton « Afficher ma position GPS » (autorisation de localisation du navigateur) |
| telechargement-gpx | oui | Lien dans la fenêtre d'une trace |

## Particularités techniques

Comportements **techniques** de l'application valables pour tout le site, qui font échouer un test naïf et qu'un lecteur ne devine pas
(liste chargée en différé, tâche asynchrone, page lente, iframe sur tout un parcours). Lus à l'étape « Préparer » des recettes.

- **Critère** : ce n'est ni une fonctionnalité (→ `doc/`), ni un scénario, ni un bug de ticket, ni une procédure, ni une valeur d'environnement.
  Un piège lié à un **élément précis** (shadow DOM, iframe, élément masqué) va dans la colonne « Notes » de `selectors.md`, pas ici.
- **Format** : `symptôme → cause → quoi faire`, daté, quelques lignes. Retirer l'entrée quand l'application est corrigée.

Entrées :

- *2026-11-25* — **Traces chargées en différé** : la carte s'affiche avant les traces (le fichier de traces est lu après le chargement
  de la page) → une carte sans trace juste après l'ouverture n'est pas un défaut → attendre les traces avant de conclure.
- *2026-11-25* — **Fond de carte tiers** : les tuiles viennent d'un service externe, hors périmètre de la recette → leur absence
  n'est pas un défaut tant que les traces sont dessinées.
- *2026-11-25* — **Site local** : les scénarios « dépôt d'une trace sur le Drive » tournent sur une copie locale de l'application
  (Drive simulé), pas à l'adresse de `RECETTE_URL` → voir `README.md` (§ Parcours du projet).
