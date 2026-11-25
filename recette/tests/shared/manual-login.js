/**
 * Login MANUEL de secours, partagé par `src/login-preprod.mjs --manuel` et par l'ouverture de session
 * (tests/web/lib/session.js) quand la connexion automatique échoue, y compris quand la page de connexion n'a pas les
 * sélecteurs attendus (SelectorNotFoundError pendant la connexion, souvent un écran SSO) : pas de heal dans ce cas si
 * l'affichage est disponible et RECETTE_LOGIN_MANUAL_FALLBACK ≠ non.
 *
 * Une fenêtre Chromium VISIBLE s'ouvre sur l'URL de connexion ; l'utilisateur se connecte lui-même (SSO, 2FA, captcha).
 * Ce module ne lit, ne tape et n'affiche JAMAIS d'identifiant ni de contenu de page ; l'URL n'est jamais affichée.
 * Fin de connexion : RECETTE_LOGIN_DONE_URL_PATTERN (expression régulière testée sur l'URL) et/ou
 * RECETTE_LOGIN_DONE_SELECTOR (élément visible une fois connecté) ; sans l'un ni l'autre, `page.pause()`
 * (cliquer sur « Resume » dans l'Inspector). Délai max : RECETTE_LOGIN_TIMEOUT_S (défaut 300).
 */
import { chromium } from 'playwright';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

/** Un affichage graphique est-il disponible ? (Linux : DISPLAY ou WAYLAND_DISPLAY ; macOS/Windows : oui.) */
export function hasDisplay() {
  if (process.platform === 'linux') return !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  return true;
}

/** Repli manuel autorisé ? Désactivé seulement par RECETTE_LOGIN_MANUAL_FALLBACK=non (ou no/0/false/off). */
export function manualFallbackEnabled() {
  return !/^(non|no|0|false|off)$/i.test((process.env.RECETTE_LOGIN_MANUAL_FALLBACK || '').trim());
}

/** Chemin du fichier de session d'un scope (gitignoré). */
export function authStatePath(scope) {
  return path.resolve(`outputs/.auth/${scope}.json`);
}

/** Écrit le storageState d'un contexte, en créant le dossier ; droits restreints au propriétaire. */
export async function saveStorageState(context, file) {
  mkdirSync(path.dirname(file), { recursive: true });
  await context.storageState({ path: file });
  try { chmodSync(file, 0o600); } catch { /* système sans chmod : ignoré */ }
}

/**
 * Le DOM courant, ou l'URL, indique-t-il une page de connexion ? Utilisé pour valider une session sauvegardée.
 * `passwordSelector` : sélecteur du champ mot de passe (clé login-champ-mot-de-passe) ; défaut générique.
 * Aucun contenu n'est lu ni affiché : seulement des booléens.
 */
export async function looksLoggedOut(page, { passwordSelector, loginPath } = {}) {
  const pw = page.locator(passwordSelector || 'input[type="password"]').first();
  if (await pw.isVisible().catch(() => false)) return true;
  if (passwordSelector && await page.locator('input[type="password"]').first().isVisible().catch(() => false)) return true;
  if (loginPath) {
    try { if (new URL(page.url()).pathname === loginPath) return true; } catch { /* URL illisible */ }
  }
  const selector = process.env.RECETTE_LOGIN_DONE_SELECTOR;
  if (selector) {
    const ok = await page.locator(selector).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
    if (!ok) return true;
  }
  const urlPattern = process.env.RECETTE_LOGIN_DONE_URL_PATTERN;
  if (urlPattern) {
    let re;
    try { re = new RegExp(urlPattern); } catch { re = { test: (u) => u.includes(urlPattern) }; }
    if (!re.test(page.url())) return true;
  }
  return false;
}

/** Attend que l'utilisateur ait fini de se connecter dans `page` (fenêtre visible). */
export async function waitForManualLogin(page) {
  const timeout = (Number(process.env.RECETTE_LOGIN_TIMEOUT_S) || 300) * 1000;
  const urlPattern = process.env.RECETTE_LOGIN_DONE_URL_PATTERN;
  const selector = process.env.RECETTE_LOGIN_DONE_SELECTOR;
  if (!urlPattern && !selector) {
    console.log('Connectez-vous dans la fenêtre ouverte, puis cliquez sur « Resume » dans l\'Inspector Playwright.');
    await page.pause();
    return;
  }
  console.log(`Connectez-vous dans la fenêtre ouverte (attente max ${Math.round(timeout / 1000)} s).`);
  let re = null;
  if (urlPattern) {
    try { re = new RegExp(urlPattern); } catch { re = { test: (u) => u.includes(urlPattern) }; }
  }
  const waits = [];
  if (re) waits.push(page.waitForURL((u) => re.test(u.href), { timeout }));
  if (selector) waits.push(page.locator(selector).first().waitFor({ state: 'visible', timeout }));
  await Promise.any(waits).catch(() => { throw new Error('manual-login-timeout'); });
}

/**
 * Ouvre une fenêtre visible sur `url`, attend la fin de connexion, sauvegarde le storageState dans `storagePath`
 * et ferme la fenêtre. Lève une Error au message sûr (sans URL) en cas d'échec.
 */
export async function runManualLogin({ url, storagePath, httpCredentials }) {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (e) {
    throw new Error(`navigateur visible impossible à lancer (affichage graphique requis) : ${String(e.message).split('\n')[0].replace(/https?:\/\/\S+/g, '<URL>')}`);
  }
  try {
    const context = await browser.newContext(httpCredentials ? { httpCredentials } : {});
    const page = await context.newPage();
    await page.goto(url);
    await waitForManualLogin(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    await saveStorageState(context, storagePath);
  } finally {
    await browser.close().catch(() => {});
  }
}
