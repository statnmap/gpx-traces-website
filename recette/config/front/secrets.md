# Identifiants de test — Front

Copier ce fichier en `config/front/secrets.md`.

**Ce fichier ne contient JAMAIS de valeur réelle** : uniquement des références `.env`. Les valeurs sont dans
`.env` (gitignoré) ; l'agent ne lit jamais `.env`, il passe par `src/load-config.js`.

---

## Compte de test Front (optionnel — uniquement si le Front a une connexion)

- **Identifiant** : _(voir `.env`, variable `RECETTE_LOGIN`)_
- **Mot de passe** : _(voir `.env`, variable `RECETTE_PASSWORD`)_

Ces identifiants sont utilisés par la session du runner (formulaire de connexion piloté par les clés
`login-*` de `config/front/selectors.md`). Ils ne sont jamais écrits dans les rapports ni dans les outputs.

## HTTP Basic Auth du preprod (optionnel)

- **Login HTTP Basic Auth** : _(voir `.env`, variable `RECETTE_HTTP_LOGIN`)_
- **Mot de passe HTTP Basic Auth** : _(voir `.env`, variable `RECETTE_HTTP_PASSWORD`)_
