---
description: Exécute, relance ou reprend la recette fonctionnelle par parcours (runner Playwright du dossier recette/), répare les sélecteurs cassés (heal) et écrit le rapport
argument-hint: "[P-001,P-002] [--resume] [--list]"
---

# Recette par parcours (runner déterministe + heal ciblé)

Arguments éventuels : $ARGUMENTS

Tout se passe dans le dossier `recette/` du dépôt (commandes à lancer depuis ce dossier). Règles générales de sécurité : `recette/AGENTS.md`.

Livrable : un rapport markdown par run dans `recette/outputs/reports/front/`, organisé par parcours, avec durées, méthode d'exécution de chaque SC, sélecteurs corrigés, bilan de conformité et bilan de couverture de l'inventaire des pages.

Principe : `config/front/scenarios.md` et `config/front/parcours.md` décrivent la recette en langage naturel ; le runner en exécute la transcription en code sans rien consommer tant que rien ne casse. L'agent n'intervient que pour réparer un sélecteur cassé ou exécuter ce que le runner ne couvre pas.

Références (dans `recette/docs-agent/`) : `preparation.md` (préparation commune), `runner-heal.md` (options, codes de sortie, heal), `execution-manuelle.md`, `rapport.md`, `pieges-playwright.md`, `standard-parcours.md` (grille de rédaction et de relecture des parcours et scénarios).

## Principes non négociables

- **L'agent lance lui-même le runner** via Bash. Ne jamais demander à l'utilisateur de lancer `node`/`npm` ni lui tendre un bloc de commandes à recopier.
- **`config/front/scenarios.md` est la source de vérité**, le code du runner n'en est que la transcription. Un écart se corrige dans le code, sauf décision explicite de changer la spécification (alors modifier le `.md` après validation).
- **Jamais deux runners concurrents.** Avant tout lancement ou `--resume`, vérifier `ps aux` largement (`run-recette`, `playwright`, `node`, `chrom`). Pour attendre la fin d'un process, utiliser un moniteur sur sa fin, pas un `sleep`.
- **Une seule session par run** (`preparation.md`, § 6), isolée seulement si le scénario ou le parcours le déclare (`Session isolée`) ou en récupération d'erreur grave.
- **Pas de script jetable** : specs du runner et Playwright MCP seulement (`preparation.md`, § 7).
- **Mode parcours = dépendances réelles**, pas vitesse : un happy path en session continue n'existe que parce qu'une étape dépend fonctionnellement de la précédente.
- **Environnement autorisé uniquement** : l'hôte doit figurer dans `RECETTE_ALLOWED_HOST_PATTERNS` ; sinon stopper.
- **Aucun secret dans la conversation ni dans les sorties** : jamais de `grep` qui affiche une ligne entière d'un fichier de secrets, ni de mot de passe, jeton ou URL complète d'environnement dans le rapport. Ne jamais lire `.env`.
- **Rapports dans `outputs/reports/` uniquement** (gitignoré). Jamais d'Artifact, de page hébergée ni de service externe.
- **Pas de trace ni de vidéo Playwright** sur un run avec connexion. Preuves visuelles par `session.capture()` seulement, jamais sur une page de connexion ni de paiement.
- **Aucun commit ni push sans confirmation humaine explicite et séparée.**
- Cette commande ne gère pas les défauts : un échec est consigné dans le rapport, point.

## Workflow

### 0. Contrôler le dossier

Depuis `recette/` : `.env` présent (le vérifier sans l'ouvrir : `ls .env`), dépendances installées (`node_modules/`), hooks git actifs (`git config core.hooksPath` vaut `.githooks`). Sinon, l'expliquer et faire corriger : `.env` est rempli par l'utilisateur lui-même, `npm install` et `npm run setup-hooks` se lancent après accord.

### 1. Cadrer

Le scope est `front`. Vérifier que `runner/run-recette.mjs`, `config/` et `doc/` existent.

### 2. Préparer

1. Préparation commune (`docs-agent/preparation.md`, § 1 à 3) : `config/front/site.md` (environnement, hôtes autorisés, fonctionnalités, « Particularités techniques »), Notes de `selectors.md` des pages touchées, autorisations cadrées en un seul `AskUserQuestion` si des écritures sont prévues.
2. Lire `config/front/scenarios.md` et `config/front/parcours.md`. Repérer les SC dupliqués.
3. Lire `config/front/selectors.md` ; garder deux dictionnaires en mémoire : `SELECTORS_KNOWN` et `SELECTORS_UPDATED` (corrections de la recette).
4. Lire `doc/inventaire-pages.md` s'il existe (couverture, voir `docs-agent/rapport.md`). Absent : ignorer la couverture, sans bloquer.
5. Résoudre les **conditions** de chaque happy path contre les fonctionnalités de `site.md` : condition non remplie → `⏭️ N/A [raison]`, ne pas exécuter.
6. Parcours à fréquence limitée : si un rapport des 31 derniers jours montre une exécution, marquer `⏭️ Différé`.
7. Si le MCP Playwright n'est pas actif (nécessaire pour les SC manuels et le heal), le signaler et demander de redémarrer Claude Code ; ne pas continuer sans lui si des SC manuels sont prévus.

### 3. Couverture instantanée (optionnel, sans session)

`node runner/run-recette.mjs --list` liste, par parcours, les SC, ceux transcrits ou non, et le dernier statut.

### 4. Lancer le runner

```bash
node runner/run-recette.mjs --parcours=P-001,P-002
```

Vérifier d'abord qu'aucun autre runner ne tourne. Run long ou connexion manuelle : lancer en arrière-plan et suivre la fin réelle du process. Codes de sortie :

- **0** : tout est passé. Lire le fichier de résultats de `outputs/heal/` : chaque SC à `SKIP` (non transcrit) rejoint la liste « à exécuter manuellement » ; les autres sont retenus comme exécutés par le runner (méthode « Runner autonome »).
- **2** : sélecteur cassé. Boucle heal (étape 5).
- **3** : un autre runner tient le verrou : vérifier `ps aux`, attendre.
- **4** : rien trouvé à exécuter. **Ce n'est pas un succès** : ne jamais annoncer une recette passée. Lire le message (il liste les parcours connus), corriger l'identifiant ou transcrire les SC, puis relancer.
- **autre** : diagnostic court (sans extrait brut contenant des données), puis demander à l'utilisateur.

### 5. Boucle heal (code 2)

Relire la Note de `selectors.md` de la clé cassée et les « Particularités techniques » de `site.md` (iframe, shadow DOM, élément masqué, chargement différé : causes fréquentes d'un faux « sélecteur cassé »), puis lire le JSON indiqué dans `outputs/heal/`. Corriger le sélecteur dans `config/front/selectors.md` (trace dans `SELECTORS_UPDATED`), vérifier qu'aucun runner ne tourne, relancer avec `--resume`. **Plafond : 2 tentatives par step.** Au plafond, ne pas insister : le parcours concerné bascule en exécution manuelle ou en diagnostic manuel. Ne jamais corriger un sélecteur pour masquer un vrai défaut : si l'élément a disparu, c'est un constat de recette, pas un heal.

### 6. Scénarios restants : exécution manuelle via Playwright MCP

SC non transcrits (`SKIP`), SC nécessitant des données que le runner ne sait pas fournir, parcours basculés après plafond de heal : dérouler `docs-agent/execution-manuelle.md`.

### 7. Rapport

Écrire `outputs/reports/front/AAAA-MM-JJ_HHhMM_parcours.md` selon `docs-agent/rapport.md`.

### 8. Après le rapport

1. **Sélecteurs** : si `SELECTORS_UPDATED` n'est pas vide, mettre à jour `selectors.md` (nouvelle valeur, date, note `← corrigé lors de la recette AAAA-MM-JJ`) et signaler les changements à l'utilisateur (évolution voulue ou régression ?).
2. **Scénarios et parcours** : un comportement inattendu ne se corrige jamais en éditant `scenarios.md` / `parcours.md`. Seul un point de contrôle manquant se **propose** à l'utilisateur, à appliquer après validation.
3. **Découvertes techniques** : proposer où les placer (`preparation.md`, § 8) ; écrire seulement après accord.
4. **Inventaire des pages** : si des pages observées manquent à `doc/inventaire-pages.md`, proposer la mise à jour ; ne jamais modifier le fichier sans accord.
5. **Conformité** : relire le rapport (aucune URL complète, identifiant, numéro de carte, jeton), corriger avant de clore.
6. **Version HTML (proposition)** : `node scripts/md-to-html.mjs outputs/reports/front/<rapport>.md` (fichier local à côté du `.md`), puis demander avant de l'ouvrir (`--open`).
