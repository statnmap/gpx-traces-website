# Transcrire un scénario Markdown en spec JavaScript

`config/front/scenarios.md` est la **source de vérité** : les scénarios y restent écrits en toutes lettres. Une spec `*.spec.js`
n'en est qu'une transcription déterministe — jamais l'inverse. Quand le scénario change, on modifie d'abord le `.md`, puis la spec.

Comparaison de libellés tolérante (accents, casse, espaces) : `import { norm, labelRegex } from '../../shared/text-match.js'`.

## Règles

1. **Un fichier par scénario** : `SC-NNN-<slug>.spec.js`. Le runner ne charge que les fichiers `*.spec.js` hors `*.example.*`,
   triés par nom.
2. **En-tête obligatoire** : `// Source: config/front/scenarios.md#SC-001`.
3. **`export const meta`** : `{ id, title, priority, category }` repris tels quels du `.md`.
4. **`export async function run({ session, selectors, addStep, setObservations })`** : le corps du scénario.
5. **Aucun sélecteur en dur** : `getSelector(selectors, 'nom-cle')`, avec la clé déclarée dans `config/front/selectors.md`.
   Aucune URL, aucun identifiant, aucune donnée de test réelle dans la spec : naviguer par chemin relatif
   (`session.goto('/chemin')`) ou `session.gotoHome()`.
6. **Éléments qui doivent exister** → `session.expectSelector(locator, { key, selector, source, scenario: meta.id })`.
   S'il est introuvable, le runner s'arrête (code 2) et Claude répare le sélecteur (heal) — ne jamais attraper cette erreur.
7. **Assertions métier** → `addStep(ok, 'texte lisible')`. Un `false` marque le scénario ❌ sans arrêter la recette.
   Une ligne `addStep` par phrase de « Résultat attendu » du `.md`.
8. **Pas de capture d'écran** d'un écran de connexion ni d'une page avec données personnelles. Preuve visuelle :
   `await session.capture('SC-001', 'slug')` (voir § « Captures de preuve »). `session.screenshot(nom)` reste un outil de debug.
   Les deux assainissent le nom : `[A-Za-z0-9._-]` seulement, sinon erreur claire.
9. **Données créées** (libellés, noms fictifs) : `testValue('base', { maxLength })` de `../lib/test-data.js`
   (suffixe `recette-AAAAMMJJ-n`), jamais une valeur en dur dans la spec ; sonder d'abord la validation du champ.
10. **Scénario non transcrit** : rien à faire — en mode parcours, le runner le marque `SKIP` (à exécuter
    manuellement avec Claude) ; `--list` donne la couverture.

## Specs éphémères

Un contrôle ponctuel s'écrit aussi en spec, jamais en script jetable : `SC-RT-NNN-<slug>.spec.js`, `meta.id` en `SC-RT-NNN`.
Elles sont **gitignorées** (`*-RT-*.spec.js`), **exclues** de tout run normal et de `--list`, et ne sont jouées que par
`node runner/run-recette.mjs --ephemeres`. Mêmes règles que ci-dessus (clés de `selectors.md`, une clé manquante s'y AJOUTE avec
la date, helpers existants). **Intégration** = renommage `SC-RT-NNN-…` → `SC-NNN-…`, `meta.id` et ligne `// Source:` mis à jour,
scénario écrit dans `scenarios.md` (après validation).

## Correspondance md → js

| Dans le `.md` | Dans la spec |
|---|---|
| `## [SC-001] Titre` | `meta.id`, `meta.title` |
| `**Priorité**` / `**Catégorie**` | `meta.priority`, `meta.category` |
| « Ouvrir la page d'accueil » | `await session.gotoHome()` |
| « Aller sur la page X » | `await session.goto('/chemin-relatif')` |
| « Vérifier que X est affiché » (élément requis) | `session.expectSelector(…)` puis `addStep(true, …)` |
| « Vérifier qu'il y a au moins N éléments » | `count()` puis `addStep(n >= N, …)` |
| « Cliquer sur X » | `await session.page.locator(getSelector(selectors, 'cle')).first().click()` |
| **Résultat attendu** | un ou plusieurs `addStep(…)` |

## Captures de preuve

`const fichier = await session.capture('SC-001', 'confirmation');` → `outputs/screenshots/SC-001-confirmation.png`.

- À appeler **délibérément**, à l'état à prouver (changement d'interface, libellé, état d'erreur, confirmation), pas à chaque étape.
- Pleine page, bandeau hors DOM : hôte seulement (jamais chemin ni query), horodatage, identifiant.
- Éléments à masquer (bandeau de cookies, widget) : section `## Masquer aux captures` de `config/front/selectors.md`, une puce
  `` - `sélecteur CSS` — raison `` par élément ; `visibility:hidden` pendant la capture, restauré ensuite (même en cas d'échec).
- Le masquage ne cache **que** ce qui est déclaré (rien d'automatique) ; le nombre d'éléments masqués est journalisé.
- **Refus** avec erreur claire (`CaptureRefusedError`) sur les pages de connexion ou de saisie sensible. Une spec ne doit pas attraper
  cette erreur pour contourner le refus : si l'écran à prouver est sensible, décrire la preuve par du texte.
- Pas de trace ni de vidéo Playwright sur un run avec connexion (elles rejouent les valeurs saisies).

Modèle complet : `SC-001.example.spec.js`.
