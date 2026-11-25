/**
 * Captures de PREUVE de recette : `session.capture(id, slug)` → `outputs/screenshots/<ID>-<slug>.png`.
 *
 * - Pleine page, avec un bandeau composé HORS DU DOM (image d'en-tête rendue dans un contexte navigateur séparé, puis
 *   collée au-dessus de la capture) : aucun pixel de la page testée n'est recouvert et aucun nœud n'est injecté.
 *   Le bandeau porte l'HÔTE seulement (jamais le chemin ni la query : un jeton d'URL n'a rien à faire sur une preuve),
 *   l'horodatage et l'identifiant du scénario.
 * - Masquage préalable des éléments listés dans la section « ## Masquer aux captures » de config/<scope>/selectors.md
 *   (barres de debug, bandeaux, widgets) par `visibility:hidden` — jamais `display:none` (les nœuds restent présents
 *   et mesurables) — restauré dans un `finally`, y compris si la capture échoue.
 * - Le masquage ne cache QUE ce qui est déclaré : il n'y a aucune détection automatique de données personnelles. La capture
 *   journalise le nombre d'éléments masqués ; l'utilisateur relit chaque capture avant de la partager.
 * - REFUS (erreur claire, rien n'est écrit) : scope back-office (données personnelles possibles) sauf ouverture volontaire par
 *   RECETTE_ALLOW_BO_CAPTURE=oui ET section « Masquer aux captures » de config/backoffice/selectors.md NON VIDE (au moins un
 *   sélecteur) ; et toute page de connexion ou de saisie sensible (jamais de capture de login, aucune exception, aucun forçage).
 * - Noms assainis (tests/shared/safe-name.js) : un nom hors [A-Za-z0-9._-], avec `..` ou `/` est refusé.
 *
 * À appeler DÉLIBÉRÉMENT, quand une preuve visuelle apporte quelque chose (changement d'interface, libellé, état d'erreur,
 * écran de confirmation) ; pas sur une assertion sans rendu ni sur un écran à données personnelles.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertSafeFileName } from '../../shared/safe-name.js';
import { loadMaskSelectors } from './selectors.js';

export const SCREENSHOT_DIR = path.resolve('outputs/screenshots');

/** Chemins typiques d'une page de connexion, d'authentification forte ou de paiement (segments de chemin, hôte exclu). */
const SENSITIVE_PATH = /(^|[/_-])(login|log-in|signin|sign-in|connexion|se-connecter|auth|sso|oauth|2fa|mfa|otp|password|mot-de-passe|paiement|payment|pay|checkout|3ds|carte-bancaire)([/_.-]|$)/i;
const SENSITIVE_FRAME = /(payment|paiement|checkout|3ds)/i;

export class CaptureRefusedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CaptureRefusedError';
  }
}

function boCaptureAllowed() {
  return /^(oui|1|true)$/i.test(process.env.RECETTE_ALLOW_BO_CAPTURE || '');
}

/** Raison de refus (texte sans URL ni donnée de page) si la page courante est une page de connexion ou de saisie sensible. */
async function sensitivePageReason(page) {
  let pathname = '';
  try { pathname = new URL(page.url()).pathname; } catch { /* URL non analysable : on s'en remet au DOM */ }
  if (SENSITIVE_PATH.test(pathname)) return 'le chemin évoque une page de connexion ou de saisie sensible';
  if (page.frames().some((f) => f !== page.mainFrame() && SENSITIVE_FRAME.test(f.url()))) return 'un cadre de paiement est présent';
  const inDom = await page.evaluate(() => {
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
    const fields = [...document.querySelectorAll('input[type="password"], input[autocomplete^="cc-"], input[autocomplete="one-time-code"]')];
    return fields.some(visible);
  }).catch(() => false);
  if (inDom) return 'un champ mot de passe, code à usage unique ou carte bancaire est visible';
  return null;
}

/** Masque les éléments (visibility:hidden), mémorise leur état dans la page ; retourne le nombre d'éléments masqués. */
function hideElements(page, selectors) {
  return page.evaluate((sels) => {
    const saved = [];
    for (const sel of sels) {
      let nodes = [];
      try { nodes = [...document.querySelectorAll(sel)]; } catch { /* sélecteur invalide : ignoré */ }
      for (const el of nodes) {
        saved.push({ el, style: el.getAttribute('style') }); // attribut d'origine, restauré à l'identique
        el.style.setProperty('visibility', 'hidden', 'important');
      }
    }
    window.__recetteMasked = saved;
    return saved.length;
  }, selectors);
}

function restoreElements(page) {
  return page.evaluate(() => {
    for (const { el, style } of window.__recetteMasked || []) {
      if (style === null) el.removeAttribute('style'); else el.setAttribute('style', style);
    }
    delete window.__recetteMasked;
  });
}

/**
 * Colle le bandeau AU-DESSUS du PNG dans une page jetable d'un contexte navigateur séparé (aucun événement `page`
 * ne parvient au contexte testé, aucun cookie partagé, aucun réseau : tout est en `data:`). Échelle 1:1.
 */
async function composeWithBanner(browser, shot, text) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 200 } });
  try {
    const sheet = await ctx.newPage();
    await sheet.setContent(
      `<!doctype html><meta charset="utf-8"><style>
        html,body{margin:0;padding:0;background:#fff}
        #bandeau{background:#0b3d5c;color:#fff;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:4px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #shot{display:block}
      </style><div id="bandeau"></div><img id="shot" alt="" src="data:image/png;base64,${shot.toString('base64')}">`,
      { waitUntil: 'load' },
    );
    // textContent : le texte du bandeau ne peut jamais injecter de balise.
    const { width, height } = await sheet.evaluate(async (t) => {
      const banner = document.getElementById('bandeau');
      banner.textContent = t;
      const img = document.getElementById('shot');
      if (!img.complete) await img.decode();
      return { width: Math.max(1, img.naturalWidth), height: banner.offsetHeight + img.naturalHeight };
    }, text);
    await sheet.setViewportSize({ width, height: Math.max(1, Math.min(600, height)) });
    return await sheet.screenshot({ fullPage: true });
  } finally {
    await ctx.close();
  }
}

/**
 * Fabrique `capture(id, slug)` pour une page. `isBo` : session du back-office (refus par défaut).
 * Les éléments à masquer sont relus à chaque capture (le heal peut modifier selectors.md en cours de run).
 */
export function createCapture({ page, browser, scope = 'front', isBo = false }) {
  return async function capture(id, slug) {
    const fileId = assertSafeFileName(id, 'capture : identifiant');
    const fileSlug = assertSafeFileName(slug, 'capture : slug');
    const fileName = assertSafeFileName(`${fileId}-${fileSlug}`, 'capture : nom');

    if (isBo && !boCaptureAllowed()) {
      throw new CaptureRefusedError('Capture refusée : le back-office peut afficher des données personnelles (RECETTE_ALLOW_BO_CAPTURE=oui pour un back-office de données fictives uniquement).');
    }
    // Back-office : l'ouverture volontaire n'est valable que si au moins un sélecteur est déclaré à masquer. Le masquage
    // ne cache QUE ce qui est déclaré : sans liste, rien ne protégerait les données affichées.
    const masks = loadMaskSelectors({ scope });
    if (isBo && masks.length === 0) {
      throw new CaptureRefusedError(`Capture refusée : RECETTE_ALLOW_BO_CAPTURE=oui exige au moins un sélecteur dans la section « Masquer aux captures » de config/${scope}/selectors.md (masquage des données affichées par le back-office). Section vide ou absente.`);
    }
    const reason = await sensitivePageReason(page);
    if (reason) throw new CaptureRefusedError(`Capture refusée : page de connexion ou de saisie sensible (${reason}). Jamais de capture de ces écrans.`);

    let host = 'hôte inconnu';
    try { host = new URL(page.url()).hostname || host; } catch { /* about:blank, etc. */ }
    const banner = `RECETTE · ${host} · ${new Date().toISOString()} · ${fileId}`;

    await mkdir(SCREENSHOT_DIR, { recursive: true });
    const file = path.join(SCREENSHOT_DIR, `${fileName}.png`);
    try {
      const hidden = masks.length ? await hideElements(page, masks) : 0;
      console.log(`Capture ${fileName} : ${hidden} élément(s) masqué(s) (uniquement ceux déclarés dans « Masquer aux captures »).`);
      const shot = await page.screenshot({ fullPage: true });
      await writeFile(file, await composeWithBanner(browser, shot, banner));
    } finally {
      if (masks.length) await restoreElements(page).catch(() => {});
    }
    return file;
  };
}
