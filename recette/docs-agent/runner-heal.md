# Runner déterministe et heal

Le runner (`runner/run-recette.mjs`) exécute les specs transcrites sous `tests/web/scenarios/`, avec les bibliothèques de sélecteurs, de parcours et de session de `tests/web/lib/`. En cas de doute sur une option, lire l'en-tête du script.

## Commande

```bash
node runner/run-recette.mjs [--parcours=P-001,P-002] [--resume] [--list]
```

| Option | Rôle |
|---|---|
| `--parcours=<liste>` | Limite aux parcours indiqués, séparés par des virgules (un happy path en session continue, un cas de bord en session isolée) |
| `--resume` | Reprend après correction d'un sélecteur, à l'étape en échec |
| `--list` | Lecture seule, sans session ni secret : par parcours, SC transcrits ou non, dernier statut ; code 0 et « 0 SC » quand rien n'est déclaré |

Le runner prend un **verrou** par scope : il refuse de démarrer si un autre run le tient. Un verrou périmé (process mort) se constate avec `ps aux` ; ne jamais le supprimer à la main tant qu'un process runner existe.

## Avant de lancer : jamais deux runners

```bash
ps aux | grep -iE 'run-recette|playwright|chrom|node' | grep -v grep
```

Ratisser large. Un process vivant = attendre (moniteur sur sa fin) ou demander à l'utilisateur, jamais relancer par-dessus.

## Sessions

État, verrou et fichiers de heal vivent sous `outputs/heal/`. La connexion reste ouverte autant que possible : le runner ouvre une session pour tout le run et la réutilise. Un cas de bord marqué `Session isolée` joue dans un contexte isolé cloné depuis la session, sans nouvelle connexion ; un cas de bord non marqué reste dans la session courante. Seul `--resume` rouvre la session.

Si le site exige une connexion : session sauvegardée dans `outputs/.auth/front.json` (gitignoré, jamais ouvert ni affiché). **Ne pas relancer l'authentification si cette session existe et reste valide.**

- **Login manuel de secours** (SSO, 2FA, captcha) : `node src/login-preprod.mjs front --manuel` ouvre un Chromium visible ; l'utilisateur se connecte lui-même. Fin de connexion détectée par `RECETTE_LOGIN_DONE_URL_PATTERN` et/ou `RECETTE_LOGIN_DONE_SELECTOR`. Exige un affichage graphique ; annoncer que la fenêtre attend l'utilisateur.
- **Fenêtre partagée** (`RECETTE_USE_WINDOW=1`) : `node src/recette-window.mjs start` (port `RECETTE_WINDOW_PORT`, défaut 9333), connectée par l'utilisateur ; le runner s'y connecte et ne la ferme jamais.
- **Délai de navigation** : `RECETTE_NAV_TIMEOUT_MS` (défaut 30000). Les attentes de sélecteurs restent strictes et déclenchent le heal.

Ce site étant public, aucune connexion n'est normalement nécessaire.

## Trace, vidéo et captures de preuve

Pas de trace ni de vidéo Playwright sur un run avec connexion. Preuve visuelle : `session.capture('SC-001', 'slug')` (`outputs/screenshots/SC-001-slug.png`, pleine page, bandeau hors DOM avec hôte seulement, éléments de la section « Masquer aux captures » de `selectors.md` masqués puis restaurés). Refusée sur les pages de connexion ou de paiement. Pièges de sélecteurs et de navigation : `pieges-playwright.md`.

## Codes de sortie

| Code | Sens | Action |
|---|---|---|
| 0 | Tout est passé ou SKIP, **ou « déjà terminé »** (reprise sans rien à rejouer) | Lire `outputs/heal/.last-results_<scope>_parcours_<liste>.json` |
| 1 | Erreur d'environnement ou de configuration (message nettoyé) | Diagnostic court sans donnée sensible, puis question à l'utilisateur |
| 2 | Sélecteur cassé | Boucle heal (ci-dessous) |
| 3 | Un autre runner tient le verrou | Vérifier `ps aux`, attendre sa fin |
| 4 | **Rien trouvé à exécuter** (aucune spec, `--parcours=` inconnu ou vide) | **Pas un succès.** Le message liste les parcours connus ; corriger l'identifiant ou transcrire les SC |

« Déjà terminé » (0) signifie que tout ce qui devait être joué l'a été ; « rien trouvé » (4) que rien n'a été joué : aucune conclusion de recette. Un filtre `--parcours=` mal orthographié ne doit jamais produire un faux vert.

Le fichier de résultats donne par SC : statut (`PASS`, `FAIL`, `SKIP`, `N/A`), étapes, observations, durée. Un SC `N/A` auto-déclaré par la spec (donnée de test que le runner ne sait pas produire) est à refaire en manuel s'il est réalisable.

## Heal (code 2)

1. Lire le JSON de heal indiqué dans `outputs/heal/` : clé du sélecteur, page, `domSnippet`, `interactiveTexts`. Ne jamais recopier l'extrait brut dans le rapport ni dans la conversation.
2. Si l'extrait ne suffit pas, inspecter la page via Playwright MCP (snapshot texte).
3. Corriger le sélecteur dans `config/front/selectors.md` (même clé, nouveau sélecteur, date du jour). Noter dans `SELECTORS_UPDATED` : `{clé, ancien, nouveau, détecté lors de SC-xxx}`.
4. Vérifier qu'aucun runner ne tourne, puis `--resume`.
5. **Plafond : 2 tentatives.** Au message « plafond de tentatives de heal dépassé », abandonner la délégation pour **ce parcours** : il bascule en manuel (`execution-manuelle.md`) ou en diagnostic manuel. Les autres parcours restent couverts par le runner.

Distinguer un **vrai heal** (le même élément existe sous un autre sélecteur) d'un **constat de recette** (l'élément a disparu ou le comportement a changé) : le second se consigne dans le rapport.

## Transcription des SC en code

Un SC absent des specs est `SKIP`. Pour le transcrire (guide : `tests/web/scenarios/README.md`), partir du `.md` (source de vérité), reprendre les étapes et le résultat attendu à l'identique, utiliser les clés de `selectors.md` (pas de sélecteur en dur), aucune donnée sensible en dur. Après transcription, relancer `--list`.

## Données interdites dans le code et les fichiers commités

URL d'environnement, identifiants, mots de passe, numéros de carte, jetons : uniquement par référence à des variables d'environnement lues par `src/load-config.js`.
