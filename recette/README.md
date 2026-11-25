# Recette web par parcours

Recette fonctionnelle déterministe du site (front seul) : Node + Playwright, sans IA tant qu'aucun sélecteur ne casse, puis réparation
ciblée (heal) par Claude Code. Contexte et règles pour les agents : `AGENTS.md`. Commande de lancement : `/recette-parcours`
(`../.claude/commands/recette-parcours.md`, références dans `docs-agent/`).

## Arborescence

```
AGENTS.md                      Règles agents et sécurité (CLAUDE.md y renvoie)
docs-agent/                    Références de la commande /recette-parcours (préparation, runner et heal, exécution manuelle, rapport, pièges, standard des parcours)
.env.example                   Noms des variables (valeurs vides) — copier en .env (jamais commité)
.gitignore                     .env*, outputs/, .auth/, settings.local.json, .mcp.json
package.json                   Scripts : recette, list, test, setup-hooks, install:browsers
.claude/settings.json          Hook PreToolUse : bloque la navigation MCP hors hôtes autorisés
../.githooks/                  Hooks git à la racine du dépôt : pre-commit (secrets, cartes, UUID, URL d'hôtes autorisés, emails, valeurs de .env) et commit-msg
scripts/hooks/guard-preprod.mjs  Hook Claude Code (Playwright MCP + Claude in Chrome)
scripts/md-to-html.mjs         Version HTML locale d'un rapport markdown (sans dépendance, texte échappé)
runner/run-recette.mjs         CLI : --parcours --resume --list ; verrou, état, heal
src/load-config.js             Config : variables d'env, repli sur config/*.md (références .env)
src/login-preprod.mjs          Session authentifiée (storageState → outputs/.auth/front.json) sans afficher les identifiants
src/recette-window.mjs         Fenêtre Chromium partagée (CDP local) ; le runner s'y connecte avec RECETTE_USE_WINDOW=1
tests/shared/                  assert-preprod, failure-context (heal), expect-selector, runner, safe-error, safe-name, text-match, load-test-config
tests/web/lib/                 session, capture (preuves), test-data (données tracées), selectors, parcours, report
tests/web/scenarios/           Specs *.spec.js (SC-…) + SC-001.example.spec.js + README (md → js)
config/front/                  site (+ « Particularités techniques »), secrets, selectors, scenarios, parcours
doc/                           inventaire-pages.md, parcours-utilisateurs.md
```

Le dossier est imbriqué dans le dépôt du site : la racine git est le dossier parent, et `npm run setup-hooks` configure
`core.hooksPath` sur `.githooks` à la racine (les hooks s'appliquent à tout le dépôt).

## Mise en route

1. `npm install`, `npm run install:browsers`, `npm run setup-hooks`.
2. Copier `.env.example` en `.env` et renseigner les variables (valeurs jamais lues par l'agent).
3. Rédiger les scénarios dans `config/front/scenarios.md` et les parcours dans `parcours.md`, puis les transcrire en specs
   (`tests/web/scenarios/README.md`).
4. Pour P-003 (site local) : installer les dépendances de l'application à la racine du dépôt (`npm ci`).

## Parcours du projet

| Parcours | Contenu | Où ça se joue |
|---|---|---|
| P-001 Consultation directe des traces | carte, survol, fenêtre d'une trace, filtres (catégorie, distance), position GPS ; écran d'ordinateur et smartphone simulé (tactile 390×844) | site de `RECETTE_URL` |
| P-002 Téléchargement du GPX | téléchargement réel du fichier depuis la fenêtre d'une trace, ordinateur et smartphone | site de `RECETTE_URL` |
| P-003 Dépôt d'une trace sur le Drive | une trace déposée dans un Drive **simulé** apparaît sur le site, s'ouvre et se télécharge | copie **locale** de l'application |

- **Appareils** : `session.openVariant({ device: 'desktop' | 'mobile', geolocation })` ouvre un contexte propre (`tests/web/lib/session.js`).
- **Site local** : `tests/web/lib/local-site.js` reconstruit l'application (cache), branche son traitement des GPX sur un Drive simulé
  (copie des fichiers de test de l'application, `outputs/local-site/drive/`), et la sert sur un port libre. Rien n'est écrit sur le vrai Drive.
- **Fenêtres** : tout se joue dans une session ; le smartphone et le site local ouvrent chacun une seule fenêtre, annoncée dans la sortie du
  runner et réutilisée. Mode visible : `RECETTE_HEADED=1` (ralenti facultatif `RECETTE_SLOWMO_MS`). L'attente d'une éventuelle bannière de
  cookies après chaque navigation est de 1,5 s (`RECETTE_BANNER_WAIT_MS`).
- Le contrôle des hôtes autorisés s'applique aussi au site local : son nom d'hôte doit correspondre à `RECETTE_ALLOWED_HOST_PATTERNS`.

## Usage

```
node runner/run-recette.mjs                                   # tous les scénarios (SC-…)
node runner/run-recette.mjs --parcours=P-001,P-002            # parcours, un seul rapport
node runner/run-recette.mjs --list                            # couverture des parcours (lecture seule)
node runner/run-recette.mjs --resume                          # reprise après un heal
node runner/run-recette.mjs --ephemeres [--resume]             # specs éphémères SC-RT-NNN seules, état séparé
node src/login-preprod.mjs front --manuel                     # login manuel de secours (fenêtre visible, SSO/2FA/captcha)
node scripts/md-to-html.mjs outputs/reports/front/<rapport>.md # version HTML locale d'un rapport (--open après accord)
```

Codes de sortie : `0` terminé (ou « déjà terminé » après `--resume`) · `1` erreur (message nettoyé) · `2` sélecteur cassé → heal
(réparer `config/front/selectors.md` puis `--resume`, plafond 2 tentatives par sélecteur) · `3` un autre runner est en cours ·
`4` **rien trouvé à exécuter** (aucune spec, `--parcours=` inconnu ou vide, parcours sans SC exploitable) : pas un succès, le
message liste les parcours connus. `--ephemeres` a son propre état et ses propres résultats (suffixe `_ephemeres`) : il n'écrase
jamais l'état d'un run normal interrompu ; le verrou reste par scope. `--list` reste à `0` et affiche « 0 SC » quand il n'y a rien.
Rapports : `outputs/reports/front/` ; heal et état : `outputs/heal/` ; sessions : `outputs/.auth/front.json` (tous gitignorés).

## Captures de preuve

`session.capture('SC-001', 'slug')` → `outputs/screenshots/SC-001-slug.png` : pleine page, bandeau hors DOM (hôte seulement,
horodatage, identifiant), éléments de la section « Masquer aux captures » de `config/front/selectors.md` masqués par
`visibility:hidden` puis restaurés. **Refus** (erreur claire) sur les pages de connexion ou de saisie sensible (aucun forçage).
**Le masquage ne cache que ce qui est déclaré** ; le nombre d'éléments masqués est journalisé. Noms assainis. Pas de trace ni de
vidéo Playwright sur un run avec connexion. Détail : `AGENTS.md`, `tests/web/scenarios/README.md`.

## Session réutilisée (si le site exige une connexion)

`outputs/.auth/front.json` (gitignoré) est réutilisé et validé à chaque ouverture de session. Absent ou invalide : connexion
automatique depuis `.env` puis sauvegarde. Si elle échoue (identifiants absents, SSO/2FA/captcha) et qu'un affichage est
disponible, une fenêtre de login manuel s'ouvre (sauf `RECETTE_LOGIN_MANUAL_FALLBACK=non`), la session est sauvegardée et le
run continue ; sinon erreur claire. Jamais de ré-authentification préventive ; `--resume` réutilise la session.

## Fenêtre partagée (`RECETTE_USE_WINDOW=1`)

Pour un environnement avec 2FA/SSO sans identifiants stockables : `node src/recette-window.mjs start` ouvre une fenêtre Chromium
(port `RECETTE_WINDOW_PORT`, défaut 9333) ; l'utilisateur s'y connecte lui-même, puis le runner est lancé avec
`RECETTE_USE_WINDOW=1`.

- Ce mode est **prioritaire** sur la session sauvegardée : aucune connexion automatique, aucun repli manuel, `outputs/.auth/*.json`
  n'est ni lu ni écrit. Fenêtre non lancée ou non connectée = erreur claire (code 1), sans dump.
- Le runner n'ouvre que **son onglet** et ne ferme **jamais** la fenêtre.
- Les identifiants HTTP Basic (`RECETTE_HTTP_*`) **ne s'appliquent pas** à la fenêtre.
- `cloneIsolated` (cas de bord à état propre) fonctionne : nouveau contexte isolé, initialisé avec la session de la fenêtre.
- Arrêt de la fenêtre : `node src/recette-window.mjs stop`.

## Délai de navigation

`RECETTE_NAV_TIMEOUT_MS` (défaut 30000 ms) borne les navigations et attentes de page du runner. L'attente de « réseau inactif »
(`networkidle`) est faite **au mieux** : un délai dépassé alors que la page est chargée ne fait pas échouer. Les attentes de
**sélecteurs** (`expectSelector`) restent strictes et gardent le heal.

## Vérifications propres à l'application

`tests/shared/text-match.js` fournit `norm` et `labelRegex` (comparaison de libellés insensible aux accents, à la casse et aux
espaces ; test : `npm test`).

## Login manuel de secours

`node src/login-preprod.mjs front --manuel` ouvre un Chromium visible sur l'URL de connexion : l'utilisateur se connecte
lui-même (SSO, 2FA, captcha), le script attend la fin de connexion (`RECETTE_LOGIN_DONE_URL_PATTERN` expression régulière sur
l'URL, et/ou `RECETTE_LOGIN_DONE_SELECTOR`, sinon `page.pause()`, délai `RECETTE_LOGIN_TIMEOUT_S`) puis écrit
`outputs/.auth/front.json`. Il ne lit ni n'affiche jamais les identifiants.

## Rapport en HTML

`node scripts/md-to-html.mjs outputs/reports/front/<rapport>.md [--open]` génère un `.html` local à côté du rapport markdown
(sans dépendance, texte échappé, rien d'ajouté) ; `--open` ouvre le navigateur, à n'utiliser qu'après accord.
