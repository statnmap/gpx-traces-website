# Recette fonctionnelle par parcours — Référence agents

Recette automatisée du site (carte interactive de traces GPX : Leaflet, build webpack, `npm start`, déployé via GitHub Pages) par un runner déterministe Node + Playwright, avec réparation ciblée (heal) par Claude Code. Site public, sans connexion ni back-office : scope **front** uniquement.
Ce fichier est la référence d'entrée pour tout agent IA sur ce dossier (`CLAUDE.md` y renvoie). La commande `/recette-parcours` (`../.claude/commands/recette-parcours.md`) lance une recette ; ses références sont dans `docs-agent/`. **Tout parcours ou scénario ajouté ou modifié suit `docs-agent/standard-parcours.md`.**

Le dossier `recette/` est imbriqué dans le dépôt du site : la racine git est le dossier parent, et les hooks git vivent à la racine (`../.githooks`).

---

## Règles agents (toujours)

- **Think before coding** : ne pas supposer, ne pas masquer un doute, exposer les compromis ; en cas d'incertitude, demander.
- **Keep It Stupid Simple** : le minimum de code qui résout le problème, rien de spéculatif.
- **Surgical changes** : ne toucher que ce qui est nécessaire.
- **Pas d'anomalie sans revérification** : une liste ou un compteur à 0 peut n'être qu'un chargement asynchrone. Avant de
  signaler un bug, réattendre plus longtemps et relire le contenu réel de la page (`innerText`) ; en cas de doute,
  rapporter « à revérifier » plutôt qu'un échec.
- **Fichiers temporaires hors dépôt** : captures, snapshots, exports d'essai → toujours un chemin absolu dans le
  répertoire temporaire de la session, jamais un chemin relatif.
- **Écrire un fichier avec Write/Edit**, jamais via `cat <<EOF`, `echo >` ou `tee`.
- **Commandes shell statiquement analysables** : éviter les boucles `for`, `find | xargs`, `node -e "..."` ; préférer une liste
  littérale de fichiers, un glob, ou écrire le code dans un fichier puis l'exécuter.
- **Ne jamais lire `../credentials.json`** (identifiants du site, hors périmètre de la recette).

---

## Modifier des fichiers texte

Utiliser l'outil `Edit`/`Write`, ou un remplacement sur chaîne littérale. Jamais de `String.replace` JavaScript ni de `sed` dont
le texte remplaçant contient `$` ou `&` (ils y insèrent le texte qui précède ou le motif trouvé : un fichier a déjà reçu une
copie de son propre début). Après une série de modifications, relire `git diff --stat` et s'étonner de toute croissance
anormale. Le hook `pre-commit` bloque un début de fichier `.md` répété.

## Règles absolues de sécurité

1. **Hôtes autorisés uniquement** : vérifier que l'hôte correspond à un motif de `RECETTE_ALLOWED_HOST_PATTERNS` avant toute
   navigation. Le hook `scripts/hooks/guard-preprod.mjs` bloque les navigations MCP hors motifs, mais une redirection ou un
   clic vers un site externe n'est pas vu : vérifier l'hôte.
2. **Jamais lire `.env`** (ni `cat`, `Read`, `grep` d'une ligne complète). Pour vérifier qu'une variable existe, n'extraire
   que son nom (`grep -oE '^RECETTE_[A-Z_]+' .env`). Les valeurs ne passent que par les scripts (`src/login-preprod.mjs`,
   `src/load-config.js`), qui ne les affichent jamais.
3. **Jamais écrire** secret, login, mot de passe, numéro de carte, **ni URL/domaine réel** dans un fichier commité, un
   rapport, un message ou une sortie. Toute URL/identifiant s'écrit comme référence `.env`
   (`` _(voir `.env`, variable `RECETTE_<CHOSE>`)_ ``) — y compris dans `config/front/*.md`.
4. **Pas de capture d'écran** d'un écran de connexion ou d'un formulaire sensible rempli. Pour vérifier un écran de
   connexion, passer par le texte de la page, pas par une image.
5. **Jamais l'outil Artifact** pour les rapports de recette ni tout contenu lié aux tests : un artifact est hébergé sur un
   serveur externe. Les rapports restent dans `outputs/reports/`.
6. **Jamais de `git commit` ni de `git push`/`gh pr create` sans demande explicite** de l'utilisateur portant sur cette
   action précise. Messages de commit : décrire le *quoi* et le *pourquoi*, jamais de donnée de test, d'URL, d'email ni
   d'identifiant réel. Les hooks `../.githooks/` (à activer : `npm run setup-hooks`) bloquent notamment `.env`, clés API,
   n° de carte, UUID complets, URL d'hôtes autorisés, emails, et toute valeur présente dans `recette/.env`.
7. **Pas de trace ni de vidéo Playwright sur un run avec connexion** (`tracing`, `recordVideo`, `trace: 'on'`) : elles
   rejouent les valeurs saisies et capturent les écrans de connexion. Les preuves visuelles passent uniquement par
   `session.capture()` (voir « Captures de preuve »).

---

## Fonctionnement de la recette

- **Claude lance le runner lui-même** (`node runner/run-recette.mjs ...` via l'outil Bash) ; on n'impose jamais `node`/`npm`
  en direct à l'utilisateur.
- **Jamais deux runners en même temps** : le runner pose un verrou (`outputs/heal/.lock_<scope>.json`, code de sortie 3 si
  déjà pris). Avant de relancer, vérifier `ps aux` largement et attendre la vraie fin du process en cours.
- **`config/front/scenarios.md` est la source de vérité** ; les specs `tests/web/scenarios/*.spec.js` n'en sont que la
  transcription (guide : `tests/web/scenarios/README.md`), jamais l'inverse. Parcours (`parcours.md`) : une session continue
  se justifie par une **dépendance fonctionnelle** entre scénarios.
- **Connexion ouverte autant que possible** : un run réutilise la même session. Ne fermer, rouvrir ou isoler une session que
  si un scénario ou un parcours le déclare (`Session isolée`), ou en récupération d'erreur grave.
- **Rien trouvé n'est pas un succès** : « aucun scénario/parcours trouvé » sort en **code 4** avec la liste de ce qui est
  disponible ; ne jamais le présenter comme une recette passée. « Déjà terminé » reste un **code 0** au message clair.
- **Ressource inaccessible** (maquette, lien, pièce jointe que l'on ne peut pas ouvrir) : la demander à l'utilisateur ;
  **ne jamais inventer d'assertions** à partir de ce qu'on suppose qu'elle contenait.
- **Données créées par les scénarios** : toujours via `tests/web/lib/test-data.js` (suffixe de traçabilité
  `recette-AAAAMMJJ-n`, jamais de valeur en dur dans une spec).
- **Heal** : sur un sélecteur cassé, le runner écrit `outputs/heal/*.json` et sort avec le **code 2**. Claude lit ce
  contexte, répare la ligne de `config/front/selectors.md`, puis relance la même commande avec `--resume`. **Plafond : 2
  tentatives par sélecteur** ; au-delà, c'est probablement un changement fonctionnel → diagnostic manuel avec l'utilisateur.
- **Sortie sans dump brut** : ne jamais afficher une erreur ou un objet brut (le « Call log » Playwright contient des URL
  de session ; `domSnippet`/`interactiveTexts` peuvent contenir des données réelles). Le runner n'imprime que des messages nettoyés.
- **Particularités techniques** (comportement qui fait échouer un test naïf et qu'on ne devine pas : shadow DOM, iframe, élément
  masqué, liste chargée en différé, tâche asynchrone) : lire la section « Particularités techniques » de `config/front/site.md`
  et les Notes de `selectors.md` des pages touchées **avant de tester** et avant d'écrire un sélecteur. Une découverte se **propose**
  à l'utilisateur, qui dit où elle va ; écriture après accord, datée, format « symptôme → cause → quoi faire »
  (voir `docs-agent/preparation.md`, § 8).
- **Pas de script jetable** : les contrôles s'écrivent en specs dans `tests/web/scenarios/`, avec les clés de `selectors.md` et
  les helpers existants ; une clé manquante s'AJOUTE à `selectors.md` (datée), jamais codée en dur.
- Après une exploration ou une recette qui découvre une page ou un état nouveau : proposer de mettre à jour `doc/inventaire-pages.md`.
- **Scénario ou parcours évoqué hors commande** : quand l'utilisateur évoque, en dehors de `/recette-parcours`, l'ajout d'un point de
  contrôle, d'un cas de bord, d'un scénario ou d'un parcours (« on devrait aussi tester… », « ajoute un cas pour… », « il faudrait un
  parcours… »), ou quand un échange ou une correction révèle un manque de couverture, **le reconnaître tout de suite** : lire
  `docs-agent/standard-parcours.md`, poser « que perd l'utilisateur si c'est faux ? », puis proposer la livraison complète (scénario et
  parcours dans `config/front/`, spec du runner, sélecteurs, rejeu, doc de `doc/`) plutôt que d'éditer un seul fichier. Besoin large
  (fonctionnalité ou périmètre sans scénarios) → proposer de le cadrer d'abord, parcours par parcours, avec la grille du standard.
  Rien n'est écrit avant validation.

### Authentification (si le site l'exige)

- **Réutiliser la même session, authentification web seulement si l'automatique échoue.** À l'ouverture d'une session :
  1. `outputs/.auth/front.json` existe → utilisé comme `storageState` puis **validé** ;
  2. absent ou invalide → connexion automatique avec `.env` (une seule par run), puis **sauvegarde** du `storageState` ;
  3. connexion automatique impossible (identifiants absents, SSO/2FA/captcha) **et** affichage graphique disponible **et**
     `RECETTE_LOGIN_MANUAL_FALLBACK` ≠ `non` → fenêtre de login manuel, session sauvegardée, le run continue ; sinon erreur
     nettoyée (code 1).
  Le fichier de session n'est jamais lu, affiché ni commité.
- **Login manuel de secours** : `node src/login-preprod.mjs front --manuel` ouvre un Chromium **visible** ; l'utilisateur se
  connecte lui-même, le script attend la fin de connexion (`RECETTE_LOGIN_DONE_URL_PATTERN` et/ou
  `RECETTE_LOGIN_DONE_SELECTOR`) puis sauvegarde la session. Il ne lit ni n'affiche jamais les identifiants.
- **Fenêtre partagée (`RECETTE_USE_WINDOW=1`)** : le runner se connecte (CDP) à la fenêtre lancée par
  `node src/recette-window.mjs start` (`RECETTE_WINDOW_PORT`, défaut 9333), connectée **par l'utilisateur**. Aucune connexion
  automatique ; seul l'onglet du run est fermé. Ne jamais saisir d'identifiants à la place de l'utilisateur.
- **Délai de navigation** : `RECETTE_NAV_TIMEOUT_MS` (défaut 30000). Les attentes de sélecteurs restent strictes et gardent le heal.
- **Ne pas relancer l'authentification si `outputs/.auth/front.json` existe et reste valide.**

### Commandes

```
node runner/run-recette.mjs                                              # scénarios individuels
node runner/run-recette.mjs --parcours=P-001[,P-002]  [--resume]         # mode parcours, un seul rapport
node runner/run-recette.mjs --list                                       # couverture (lecture seule)
node src/login-preprod.mjs front [--manuel]                              # session authentifiée sans afficher les identifiants
node scripts/md-to-html.mjs outputs/reports/front/<rapport>.md [--open]  # version HTML locale d'un rapport
```

Codes de sortie du runner : `0` terminé ou déjà terminé · `1` erreur · `2` heal requis · `3` un autre runner en cours ·
`4` rien trouvé à exécuter (`--list` reste à 0 et affiche « 0 SC »).

Rapports : `outputs/reports/front/AAAA-MM-JJ_HHhMM[_parcours_<id>].md`. État de reprise et heal : `outputs/heal/`. Sessions : `outputs/.auth/`.

### Captures de preuve

`await session.capture('SC-001', 'confirmation')` écrit `outputs/screenshots/SC-001-confirmation.png` : page entière, avec
un bandeau composé **hors du DOM** (hôte seulement, jamais le chemin ni la query ; horodatage ; identifiant). À appeler
délibérément, quand une preuve visuelle apporte quelque chose, pas à chaque étape.

- **Masquage** : les éléments listés dans la section « Masquer aux captures » de `config/front/selectors.md` passent en
  `visibility:hidden` pendant la capture, puis sont restaurés. Jamais `display:none`.
- **Refus par défaut** : toute page de connexion ou de saisie sensible (aucune exception).
- **Noms assainis** : `[A-Za-z0-9._-]` seulement ; `..`, `/`, nom vide sont refusés.

---

## Fichiers de config

`config/front/` : `site.md` (avec sa section « Particularités techniques »), `secrets.md`, `selectors.md`, `scenarios.md`,
`parcours.md`.

- **Commités** : tous les fichiers `config/**` — `site.md` et `secrets.md` ne contiennent que des références `.env`.
- **Jamais commités** : `.env*` (sauf `.env.example`), `outputs/`, `.auth/`, `.claude/settings.local.json`, `.mcp.json`.

**Démarrage à froid (après un clone)** : seul `.env` manque. Avant toute recette, vérifier qu'il existe et couvre les
variables nécessaires (voir `.env.example`, noms de variables seulement) ; sinon **demander à l'utilisateur** de les
renseigner. Installer ensuite : `npm install`, `npm run install:browsers`, `npm run setup-hooks`.

---

## Documentation

`doc/inventaire-pages.md` (pages et états du produit) et `doc/parcours-utilisateurs.md` (parcours, matrice de
fonctionnalités) sont lus par des humains : pas de journal de recette, parcours = chemin utilisateur, intégrer un
nouveau parcours dans un parcours existant quand c'est possible, noms neutres, aucune URL ni donnée réelle.
