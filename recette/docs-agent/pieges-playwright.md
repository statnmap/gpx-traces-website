# Pièges Playwright récurrents en recette

À lire avant de transcrire un scénario en spec ou d'exécuter un scénario manuel via Playwright MCP, et pendant un heal quand un sélecteur « devrait marcher ». Exemples en JavaScript, avec la bibliothèque `playwright` du dossier (pas `@playwright/test`).

## Popup ouverte par `window.open`

La page popup doit être attendue **avant** le clic qui la déclenche, sinon l'événement est manqué :

```js
const [popup] = await Promise.all([
  session.context.waitForEvent('page'),
  session.page.locator(getSelector(selectors, 'ouvrir-popup')).first().click(),
]);
await popup.waitForLoadState();
```

Ensuite, travailler sur `popup` (ses propres sélecteurs, sa propre vérification d'hôte autorisé) puis le fermer. Même motif pour un lien `target="_blank"`.

## Liens `javascript:` ou à `onclick`

Un lien `href="javascript:…"` ne navigue pas : un `click()` peut ne rien déclencher d'observable. Cliquer quand même, puis attendre l'effet attendu. Si le clic reste sans effet, déclencher le gestionnaire dans la page :

```js
await session.page.evaluate(() => document.querySelector('a[onclick*="action"]')?.click());
```

Le noter dans le rapport : c'est un contournement, pas un parcours utilisateur réel.

## Bascule (togglebutton) avec élément `hidden` compagnon

Certains composants affichent un bouton visible **et** portent la vraie valeur dans un `input type="hidden"` voisin. Cliquer le bouton ne met pas toujours à jour ce champ. Après le clic, vérifier la valeur du champ caché ; si elle n'a pas changé, la mettre à jour et émettre l'événement `change` :

```js
await session.page.evaluate((id) => {
  const hidden = document.getElementById(`${id}_hidden`);
  hidden.value = 'true';
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
}, 'identifiant-du-bouton');
```

Ne le faire qu'après avoir constaté l'écart, et le consigner.

## Attendre avant d'annoncer une anomalie

Une liste vide, un compteur à 0 ou un bouton absent peut n'être qu'un chargement asynchrone. Avant de conclure à un défaut :

1. réattendre plus longtemps (`locator.waitFor({ state: 'visible', timeout })`, jamais `isVisible({ timeout })` qui ne réessaie pas) ;
2. relire le contenu réel de la page (`innerText`) plutôt que de se fier au seul sélecteur ;
3. en cas de doute, rapporter « à revérifier » plutôt qu'un échec.

## Une session à la fois par compte

Le même compte de test joué en parallèle (deux runners, deux contextes) se marche dessus. Pas de lancement concurrent sur le même compte.

## Pas de secret dans les logs

Avant d'afficher une réponse réseau ou un texte de page : pas de cookie, d'en-tête `Authorization`, de jeton, de mot de passe. Une spec ne doit pas faire mieux que le runner en `console.log` : il n'imprime que des messages nettoyés.
