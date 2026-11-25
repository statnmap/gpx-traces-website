# Exécution manuelle des scénarios restants (Playwright MCP)

S'applique uniquement aux SC de la liste « à exécuter manuellement » après le passage du runner : SC non transcrits (`SKIP`), SC `N/A` auto-déclarés mais réalisables, parcours basculés après plafond de heal. Un happy path entièrement couvert par le runner n'est pas rejoué ; un happy path partiellement couvert n'exécute ici que ses SC manquants, dans une même session continue.

## Avant de commencer

Préparation faite (`preparation.md`) : « Particularités techniques » de `site.md` et Notes de `selectors.md` lues **avant la première interaction et avant d'écrire ou de corriger un sélecteur**. Une particularité découverte en route se note pour la fin : on **propose** son emplacement à l'utilisateur (`preparation.md`, § 8), on ne l'écrit qu'après accord.

## Chronométrage

Pour chaque SC : `SC_START=$(date +%s)` avant la première commande, durée calculée après le checkpoint (succès ou échec), format `m:ss`. Les attentes sont incluses. Mesurer aussi la durée totale.

## Attentes

Attentes sur sélecteur avec délai (`waitForSelector(selector, {timeout: 15000})`), jamais de pause fixe pour attendre un état de page.

## A. Happy paths

Pour chaque parcours, dans l'ordre du plan d'exécution, puis chaque happy path dans l'ordre de `parcours.md` :

1. Condition non remplie : `⏭️ N/A [raison]` pour tout le happy path.
2. Réutiliser la session déjà ouverte (n'en ouvrir une, non headless, que s'il n'y en a pas), naviguer vers l'état initial.
3. Avant la première navigation : bannière de cookies. Si le fichier de sélecteurs en signale une, l'accepter avec le sélecteur indiqué.
4. Pour chaque SC de la séquence :
   - retrouver sa description dans `scenarios.md` ;
   - utiliser `SELECTORS_KNOWN` si la clé existe ; si le sélecteur échoue, chercher une alternative et, si trouvée, l'enregistrer dans `SELECTORS_UPDATED` ;
   - exécuter les étapes **dans la session courante** (ne jamais rouvrir une session entre deux SC d'un même happy path) ;
   - vérifier le checkpoint de la colonne « Checkpoint attendu » ;
   - appliquer la couverture de l'inventaire (`rapport.md`) en réutilisant l'inspection déjà faite ;
   - **bloquant = oui et checkpoint en échec** : noter l'erreur précise, marquer ce SC ❌ avec sa durée, les SC suivants `⛔ bloqué (dépend de SC-xxx)`, fermer la session, passer au happy path suivant ;
   - **bloquant = non et checkpoint en échec** : noter l'erreur, marquer ❌, continuer dans la même session ;
   - checkpoint validé : ✅ avec la durée.
5. Fermer la session après le dernier SC du happy path.

## B. Cas de bord

Pour chaque cas de bord, dans l'ordre recommandé :

1. Marqué `Session isolée` : ouvrir un contexte isolé. Sinon : rester dans la session courante et revenir à l'état initial.
2. Chronométrer, exécuter le SC complet depuis `scenarios.md`, appliquer la couverture de l'inventaire.
3. Fermer la session. Marquer ✅, ❌ ou `⏭️ N/A` avec la durée.

Si un cas de bord dépend d'un autre, respecter l'ordre ; si le prérequis n'a pas réussi, marquer `⏭️ N/A [prérequis non exécuté]`.

## Gestion des erreurs

- **Page qui ne charge pas (timeout)** : SC ❌, noter le chemin et l'erreur, passer au suivant.
- **Contenu dans une iframe** : essayer `frameLocator('iframe')`.
- **Étape nécessitant une action humaine** : laisser le navigateur ouvert, demander à l'utilisateur d'agir, reprendre après confirmation avec un délai maximal (15 à 30 s) puis redemander.
- **Sélecteur introuvable** : capture d'écran **sauf** page de connexion ou formulaire contenant des données sensibles.

## Captures d'écran

Autorisées pour les échecs de checkpoint, sauf : écran de connexion, formulaire sensible, tout écran affichant un identifiant ou une donnée de compte. Dans le doute, décrire l'état par texte (titre, texte visible) plutôt que par image.
