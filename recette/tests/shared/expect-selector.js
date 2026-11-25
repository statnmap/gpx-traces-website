/**
 * Vérification générique d'un sélecteur connu (issu de config/{front,backoffice}/selectors.md) sur une page
 * Playwright. Sur échec : capture un extrait du DOM + une capture d'écran, puis lève
 * SelectorNotFoundError (le runner l'intercepte pour arrêter proprement et déclencher le heal
 * plutôt que de continuer sur une cascade d'échecs).
 *
 * `scope` : fichier de sélecteurs concerné (`front` ou `backoffice`) — là où le heal réparera la ligne.
 *
 * `screenshot: false` : à utiliser sur un écran de connexion (jamais de capture d'un formulaire de login,
 * même vide — règle de sécurité du projet).
 */
import path from 'path';
import { SelectorNotFoundError } from './failure-context.js';
import { toSafeFileName } from './safe-name.js';

const SCREENSHOT_DIR = path.resolve('outputs/screenshots');

export async function expectSelector(page, locator, { key, selector, source, timeout = 8000, scenario = 'unknown', urlOverride, screenshot = true, scope = 'front' } = {}) {
  // locator.isVisible() renvoie l'état immédiat, sans ré-essayer — son option `timeout` ne fait
  // PAS de polling (contrairement à ce que son nom suggère). Pour un élément qui apparaît avec un
  // léger délai (ex. modale interstitielle après un clic), il faut waitFor(), qui lui réessaie
  // bien pendant toute la durée du timeout.
  const visible = await locator.first().waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
  if (visible) return locator;

  let screenshotPath = null;
  if (screenshot) {
    screenshotPath = path.join(SCREENSHOT_DIR, `heal_${toSafeFileName(scenario)}_${toSafeFileName(key)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
  }

  // Le texte visible (innerText) est bien plus dense que le HTML brut : sur une page réelle,
  // slice(0, N) sur innerHTML brut épuise son budget dans le nav/header avant d'atteindre le
  // contenu utile. La liste des libellés bouton/lien répond en plus directement à la question
  // "quel texte utiliser pour le sélecteur ?" pour un has-text() cassé.
  const pageText = await page.locator('body').innerText().then((t) => t.slice(0, 3000)).catch(() => null);
  const interactiveTexts = await page.$$eval('button, a', (els) => els
    .map((e) => e.textContent.trim())
    .filter(Boolean)).then((texts) => texts.slice(0, 80)).catch(() => []);

  throw new SelectorNotFoundError({
    selectorKey: key,
    selectorTried: selector,
    selectorSource: source,
    selectorScope: scope,
    url: urlOverride ?? page.url(),
    domSnippet: pageText,
    interactiveTexts,
    screenshotPath,
  });
}
