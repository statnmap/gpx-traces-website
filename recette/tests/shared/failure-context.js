/**
 * Contexte d'échec transmis à Claude pour la boucle de heal (voir AGENTS.md / commande /recette-parcours).
 * Quand le runner autonome (tests/web) échoue sur un sélecteur introuvable, il appelle
 * recordSelectorFailure() plutôt que d'écrire un rapport complet : Claude ne lit ensuite que ce fichier
 * minimal pour diagnostiquer, au lieu de rejouer tout le scénario.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, rmSync } from 'fs';

const HEAL_DIR = 'outputs/heal';
const DEFAULT_MAX_ATTEMPTS = 2;

function attemptsPath(scope, selectorKey) {
  return `${HEAL_DIR}/.attempts_${scope}_${selectorKey}.json`;
}

function readAttempts(scope, selectorKey) {
  const path = attemptsPath(scope, selectorKey);
  if (!existsSync(path)) return 0;
  try {
    return JSON.parse(readFileSync(path, 'utf8')).count ?? 0;
  } catch {
    return 0;
  }
}

function writeAttempts(scope, selectorKey, count) {
  mkdirSync(HEAL_DIR, { recursive: true });
  writeFileSync(attemptsPath(scope, selectorKey), JSON.stringify({ count }));
}

/**
 * À appeler quand une étape échoue sur un sélecteur introuvable.
 * `scope` (front | backoffice) = le fichier de sélecteurs à réparer : config/<scope>/selectors.md. Un scénario
 * croisé peut donc déclencher un heal côté back-office. Incrémente le compteur de tentatives pour (scope, selectorKey) et écrit un fichier
 * de contexte minimal sous outputs/heal/. Si le plafond (2 tentatives) est dépassé, `exceeded: true` est
 * renvoyé : le runner doit alors basculer sur un diagnostic manuel plutôt que de
 * régénérer un contexte de heal (probable changement fonctionnel, pas une simple dérive UI).
 */
export function recordSelectorFailure({
  scope = 'front',
  scenario,
  step,
  selectorKey,
  selectorTried,
  selectorSource,
  url,
  domSnippet,
  interactiveTexts,
  screenshotPath,
  errorMessage,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  const attempt = readAttempts(scope, selectorKey) + 1;
  writeAttempts(scope, selectorKey, attempt);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const contextPath = `${HEAL_DIR}/${timestamp}_${scenario}.json`;

  mkdirSync(HEAL_DIR, { recursive: true });
  writeFileSync(contextPath, JSON.stringify({
    scope, scenario, step, selectorKey, selectorTried, selectorSource,
    url, domSnippet, interactiveTexts, screenshotPath, errorMessage, attempt, maxAttempts,
  }, null, 2));

  return { contextPath, attempt, exceeded: attempt > maxAttempts };
}

/** Remet le compteur à zéro pour un sélecteur donné une fois la réparation confirmée réussie. */
export function resetAttempts(scope, selectorKey) {
  const path = attemptsPath(scope, selectorKey);
  if (existsSync(path)) writeFileSync(path, JSON.stringify({ count: 0 }));
}

/**
 * À appeler quand une recette complète se termine sans aucun échec de sélecteur :
 * purge tous les compteurs de tentatives du scope (tout fonctionne à nouveau,
 * un futur échec sur un sélecteur donné ne doit pas repartir d'un compteur déjà entamé
 * par un incident précédent, désormais réparé).
 */
export function resetAllAttempts(scope) {
  if (!existsSync(HEAL_DIR)) return;
  const prefix = `.attempts_${scope}_`;
  for (const file of readdirSync(HEAL_DIR)) {
    if (file.startsWith(prefix)) rmSync(`${HEAL_DIR}/${file}`, { force: true });
  }
}

/**
 * Erreur distincte d'un échec d'assertion métier : signale qu'un sélecteur connu
 * (config/{front,backoffice}/selectors.md) n'a pas été trouvé sur la page. Le runner l'intercepte pour
 * arrêter l'exécution (au lieu de continuer au scénario suivant) et déclencher le heal,
 * plutôt que de simplement marquer le scénario ❌ et poursuivre.
 */
export class SelectorNotFoundError extends Error {
  constructor({ selectorKey, selectorTried, selectorSource, selectorScope = 'front', url, domSnippet, interactiveTexts, screenshotPath }) {
    super(`Sélecteur introuvable : ${selectorKey} (${selectorTried})`);
    this.name = 'SelectorNotFoundError';
    this.selectorKey = selectorKey;
    this.selectorTried = selectorTried;
    this.selectorSource = selectorSource;
    this.selectorScope = selectorScope; // fichier à réparer : config/<scope>/selectors.md
    this.url = url;
    this.domSnippet = domSnippet;
    this.interactiveTexts = interactiveTexts;
    this.screenshotPath = screenshotPath;
  }
}
