# Préparer une recette

Étapes communes, décrites une seule fois ici. Toutes les lectures sont **ciblées** : jamais `.env`, `outputs/` ni `.auth/`.

## 1. Lecture contextuelle par mots-clés

Chercher dans `doc/inventaire-pages.md`, `doc/parcours-utilisateurs.md`, `config/front/scenarios.md` et `parcours.md` les mots-clés de ce qui est testé (`grep -n`, jamais une lecture intégrale d'un gros fichier), et résumer en quelques lignes les règles qui concernent la recette.

**But** : tester **au-delà du critère**. Si la doc évoque une règle transverse (option activable, état vide, comportement mobile), prévoir le contrôle correspondant ou, s'il est impossible, le déclarer **avant** les tests comme angle mort connu. On ne lit un fichier en entier que s'il est petit et toujours utile (`site.md`).

## 2. Config du site et particularités techniques

- Lire `config/front/site.md` : environnement, hôtes autorisés, fonctionnalités activées et section **« Particularités techniques »** (liste chargée en différé, tâche asynchrone, page lente : un test naïf échoue sans elles). Secrets **par référence** (noms de variables) seulement.
- Lire les **Notes** de `config/front/selectors.md` des pages touchées, **par recherche de clés ou de page** (`grep -n`), jamais le fichier en entier : shadow DOM, iframe, élément masqué y sont notés à côté du sélecteur concerné.

## 3. Cadrer les autorisations (une fois, avant de tester)

Parcourir chaque parcours et noter s'il exige une **écriture** (création, modification, suppression, envoi, déclenchement d'un traitement) ou une zone interdite. Poser **toutes** les questions **d'un seul coup** : un seul `AskUserQuestion`, plusieurs questions dans l'appel, **avant** le premier test, jamais au fil de l'exécution. Réponse négative : le contrôle passe en 🟡 partiel ou ⏭ skip avec la raison, et le rapport le dit.

## 4. Antériorité : chercher l'existant avant de créer

Un scénario permanent rejoué vaut mieux qu'un doublon ; enrichir un parcours vaut mieux que d'en multiplier.

```bash
grep -niE 'mot-cle-1|mot-cle-2' config/front/scenarios.md config/front/parcours.md
ls tests/web/scenarios/
```

Classer chaque critère : **déjà couvert** (rejouer l'existant avec `--parcours=P-NNN`), **couvert en partie** (proposer d'enrichir le SC ou le parcours après validation), **non couvert** (nouveau scénario). Ne jamais modifier `scenarios.md` ni `parcours.md` sans confirmation. Aucun résultat de recherche ne se colle dans un rapport s'il contient une URL ou une donnée de compte.

## 5. Balayage de non-régression depuis la doc

Sélection **à partir de la doc**, pas de mémoire. Pour chaque page touchée : (a) tester d'abord le critère ; (b) passer en revue les « Éléments clés » de la page dans `doc/inventaire-pages.md` et vérifier ceux qui sont visibles et sans risque ; (c) retrouver les parcours qui passent par cette page (`doc/parcours-utilisateurs.md`, puis `parcours.md`). Justifier chaque proposition (page → parcours). Jamais « tout lancer » par défaut.

## 6. Règle de session

Un run réutilise une seule session pour tous les scénarios et parcours. Ne fermer, rouvrir ni isoler une session que si le scénario ou le parcours le déclare (`Session isolée`) ou en récupération d'erreur grave. Jamais deux runners concurrents (`ps aux` large avant tout lancement), jamais de lancement délégué à l'utilisateur.

## 7. Pas de script jetable

Aucun script ad hoc (`node -e`, fichier jetable, sélecteur codé en dur). Les contrôles s'écrivent en **specs** dans `tests/web/scenarios/`, avec les clés de `selectors.md` et les helpers existants ; une clé manquante s'AJOUTE à `selectors.md` (nouvelle ligne datée), jamais codée en dur. Exécution manuelle : Playwright MCP, sans script à côté.

## 8. Où ranger les découvertes (en fin de recette)

Critère d'une **particularité** : comportement technique qui fait échouer un test naïf et qu'un lecteur ne devine pas. Ce n'est pas une fonctionnalité (→ `doc/`), ni un scénario, ni un défaut, ni une procédure, ni une valeur d'environnement.

Pour chaque découverte, **proposer** l'emplacement à l'utilisateur ; **écriture seulement après accord** :

| Nature de la découverte | Emplacement |
|---|---|
| Liée à un élément précis (shadow DOM, iframe, élément masqué) | colonne « Notes » de `config/front/selectors.md`, avec la date |
| Valable pour tout le site (liste chargée en différé, tâche asynchrone, page lente) | section « Particularités techniques » de `config/front/site.md` |
| Procédure de lancement | `AGENTS.md` ou `README.md` du dossier |

Format d'une entrée : `symptôme → cause → quoi faire`, **datée**, quelques lignes, sans donnée sensible. L'entrée se retire quand l'application est corrigée.
