/**
 * Session Playwright du projet (Front ou back-office, selon `scope`).
 *
 * - Front : anonyme par défaut ; si `URL de connexion` (RECETTE_LOGIN_URL) est configurée, une
 *   connexion est faite d'abord sur ce portail avec les identifiants de test.
 * - Back-office : connexion toujours tentée (sur `URL de connexion` si définie, sinon sur l'URL du BO).
 *
 * La connexion est entièrement pilotée par le fichier de sélecteurs du scope (clés `login-champ-identifiant`,
 * `login-champ-mot-de-passe`, `login-bouton-connexion`, et optionnellement `login-bouton-etape-identifiant`
 * pour un formulaire en 2 pages). Chaque étape passe par
 * expectSelector (SelectorNotFoundError) : le mécanisme de heal (voir runner/run-recette.mjs) s'applique
 * donc sans modification côté runner. Les identifiants ne sont jamais affichés ni écrits.
 *
 * Réutilisation de la session (outputs/.auth/<scope>.json, gitignoré, jamais lu ni affiché) :
 *   1. un fichier de session existe → utilisé comme storageState, puis VALIDÉ (navigation vers l'URL du scope : session
 *      invalide = champ mot de passe visible, redirection vers la page de connexion, RECETTE_LOGIN_DONE_SELECTOR /
 *      RECETTE_LOGIN_DONE_URL_PATTERN non satisfaits) ;
 *   2. absent ou invalide → connexion automatique depuis .env, puis sauvegarde du storageState pour les runs suivants ;
 *   3. connexion automatique impossible (identifiants absents, SSO/2FA/captcha, refus, page de connexion sans les
 *      sélecteurs attendus = SelectorNotFoundError pendant la connexion) ET affichage graphique disponible
 *      ET RECETTE_LOGIN_MANUAL_FALLBACK ≠ non → fenêtre de login manuel (tests/shared/manual-login.js), session
 *      sauvegardée, le run continue ; sinon erreur nettoyée qui dit quoi faire (SelectorNotFoundError : heal habituel).
 *      Un échec réseau pendant la VALIDATION d'une session sauvegardée reste une erreur nettoyée, sans repli.
 *   Jamais de ré-authentification préventive : seulement sur constat d'invalidité. Session isolée (cloneIsolated) :
 *   copie de la session déjà validée, aucune nouvelle connexion.
 *
 * Fenêtre partagée (RECETTE_USE_WINDOW=1) : PRIORITAIRE sur tout ce qui précède. Le runner se connecte en CDP à la
 * fenêtre lancée par `node src/recette-window.mjs start` (port RECETTE_WINDOW_PORT, défaut 9333), que l'utilisateur a
 * déjà connectée lui-même (2FA/SSO compris). Aucune connexion automatique, aucun storageState lu ni écrit, aucun repli
 * manuel. La session de la fenêtre est seulement VALIDÉE (même contrôle que pour un storageState : champ mot de passe
 * visible, page de connexion, RECETTE_LOGIN_DONE_*) ; sinon erreur claire, sans dump. Le runner n'ouvre que SON onglet
 * et ne ferme JAMAIS la fenêtre (seul cet onglet est fermé). Les identifiants HTTP Basic (RECETTE_HTTP_*) ne
 * s'appliquent pas à la fenêtre : les saisir dans la fenêtre. Front et back-office partagent alors la même fenêtre
 * (même contexte navigateur, onglets distincts) : se connecter aux deux dans la fenêtre.
 *
 * Délais : RECETTE_NAV_TIMEOUT_MS (défaut 30000) pour les navigations et attentes de gotoOn. L'attente `networkidle` est
 * « au mieux » (délai dépassé alors que le DOM est chargé = on continue) ; les attentes de SÉLECTEURS restent strictes
 * (expectSelector, heal).
 *
 * Back-office : jamais de capture d'écran (pages potentiellement chargées de données clients) — expectSelector
 * est appelé avec `screenshot: false`, `session.screenshot()` ne produit rien et `session.capture()` refuse.
 * Noms de capture assainis (tests/shared/safe-name.js) ; captures de preuve : tests/web/lib/capture.js. La session BO est normalement
 * ouverte via tests/web/lib/bo-session.js (ouverture paresseuse, garde-fous), pas directement.
 */
import { chromium } from 'playwright';
import path from 'path';
import { existsSync } from 'node:fs';
import { loadSiteConfig, loadSecrets, loadHttpCredentials, loadBoConfig, loadBoSecrets } from '../../shared/load-test-config.js';
import { expectSelector as expectSelectorShared } from '../../shared/expect-selector.js';
import { assertPreprod } from '../../shared/assert-preprod.js';
import { sanitizeErrorMessage } from '../../shared/safe-error.js';
import { SelectorNotFoundError } from '../../shared/failure-context.js';
import { assertSafeFileName } from '../../shared/safe-name.js';
import { loadSelectors, getSelector } from './selectors.js';
import { createCapture } from './capture.js';
import { authStatePath, saveStorageState, looksLoggedOut, runManualLogin, hasDisplay, manualFallbackEnabled } from '../../shared/manual-login.js';

const SCREENSHOT_DIR = path.resolve('outputs/screenshots');
const VIEWPORT = { width: 1280, height: 900 };

/** Position simulée, autorisation de localisation accordée d'avance (le bouton GPS du site ne déclenche alors aucune demande). */
const DEFAULT_GEO = { geolocation: { latitude: 47.33, longitude: -1.74 }, permissions: ['geolocation'] };

/** Appareils simulables par `openVariant({ device })`. Le smartphone est un écran tactile de 390×844 (smartphone courant). */
const DEVICES = {
  desktop: { viewport: VIEWPORT },
  mobile: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
};

/** Délai des navigations (ms) : RECETTE_NAV_TIMEOUT_MS, défaut 30000. */
export function navTimeoutMs() {
  const n = Number(process.env.RECETTE_NAV_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

/** Mode fenêtre partagée : RECETTE_USE_WINDOW renseigné et différent de non/no/0/false/off. */
export function useSharedWindow() {
  const v = (process.env.RECETTE_USE_WINDOW || '').trim();
  return v !== '' && !/^(non|no|0|false|off)$/i.test(v);
}

/** Attente d'une éventuelle bannière de cookies après chaque navigation (ms) : RECETTE_BANNER_WAIT_MS, défaut 1500. */
function bannerWaitMs() {
  const n = Number(process.env.RECETTE_BANNER_WAIT_MS);
  return Number.isFinite(n) && n >= 0 ? n : 1500;
}

async function closeBanner(page) {
  try {
    const btn = page.locator('button:has-text("Continuer sans accepter"), button:has-text("Tout refuser"), button:has-text("Refuser"), button:has-text("Fermer")');
    await btn.first().waitFor({ timeout: bannerWaitMs() });
    await btn.first().click();
    await page.waitForTimeout(800);
  } catch { /* pas de bannière */ }
}

export async function openWebSession({ headless = true, scope = 'front' } = {}) {
  const isBo = scope === 'backoffice';
  const { url, loginUrl: configuredLoginUrl } = isBo ? loadBoConfig() : loadSiteConfig();
  const loginUrl = configuredLoginUrl || (isBo ? url : null);
  const httpCredentials = loadHttpCredentials();
  assertPreprod(url, `config/${scope}/site`);
  const selectors = loadSelectors({ scope });

  // Les cookies de session sont posés sur le domaine réellement visité : toute navigation relative
  // doit se faire depuis l'origine de l'URL principale (new URL(url).origin évite de concaténer un chemin
  // relatif après une éventuelle query string).
  const sessionOrigin = new URL(url).origin;
  const contextOptions = { viewport: VIEWPORT, ...DEFAULT_GEO, ...(httpCredentials ? { httpCredentials } : {}) };

  const useWindow = useSharedWindow();
  const windowPort = Number(process.env.RECETTE_WINDOW_PORT) || 9333;
  const navTimeout = navTimeoutMs();
  let browser;
  if (useWindow) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${windowPort}`, { timeout: 10000 });
    } catch {
      throw new Error(`Fenêtre partagée introuvable (port ${windowPort}) : la lancer avec « node src/recette-window.mjs start », s'y connecter (2FA/SSO compris), puis relancer (RECETTE_USE_WINDOW=1).`);
    }
    if (httpCredentials) console.log('Fenêtre partagée : identifiants HTTP Basic ignorés (non applicables à la fenêtre ; les saisir dans la fenêtre).');
  } else {
    // RECETTE_HEADED=1 : navigateur visible (pour suivre une recette à l'écran) ; RECETTE_SLOWMO_MS : ralenti entre actions.
    const headed = /^(1|oui|yes|true|on)$/i.test((process.env.RECETTE_HEADED || '').trim());
    const slowMo = Math.max(0, Number(process.env.RECETTE_SLOWMO_MS) || 0);
    browser = await chromium.launch({ headless: headless && !headed, ...(slowMo ? { slowMo } : {}) });
  }
  let context;
  let page;
  try {
    // « Au mieux » : un networkidle qui n'arrive pas (requêtes longues, websockets) ne fait pas échouer la navigation.
    const settle = (targetPage) => targetPage.waitForLoadState('networkidle', { timeout: navTimeout }).catch(() => {});

    async function gotoOn(targetPage, pathOrUrl, origin = sessionOrigin) {
      const target = pathOrUrl.startsWith('http') ? pathOrUrl : `${origin}${pathOrUrl}`;
      assertPreprod(target, `config/${scope}/site`);
      try {
        // Strict : la navigation elle-même (DOM chargé) doit aboutir dans le délai. Puis networkidle au mieux.
        await targetPage.goto(target, { waitUntil: 'domcontentloaded', timeout: navTimeout });
      } catch (err) {
        // Une redirection encore en vol (ex. après une connexion) peut interrompre cette navigation par une
        // autre vers la même URL — pas une vraie erreur si la page atterrit bien dessus.
        if (!/interrupted by another navigation/i.test(err.message)) throw err;
      }
      await settle(targetPage);
      await closeBanner(targetPage);
    }

    async function login(page) {
      const secrets = isBo ? loadBoSecrets() : loadSecrets();
      if (!secrets.login || !secrets.password) {
        throw new Error(`Identifiants manquants (${scope}) — voir .env.example`);
      }

      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout });
      await settle(page);
      await closeBanner(page);

      // Capture d'écran désactivée (screenshot: false) : jamais de capture d'un écran de connexion.
      const find = async (key) => {
        const sel = getSelector(selectors, key);
        const locator = page.locator(sel);
        await expectSelectorShared(page, locator, {
          key, selector: sel, source: `${selectors.filePath}#${key}`, scenario: 'login', screenshot: false, scope,
        });
        return locator.first();
      };

      await (await find('login-champ-identifiant')).fill(secrets.login);

      // Flux en 2 pages : l'étape identifiant a son propre bouton de validation, qui mène à une page mot de
      // passe séparée. Piloté par la présence de la clé ; absente pour un flux 1 page (même formulaire).
      if (selectors.map['login-bouton-etape-identifiant']) {
        await (await find('login-bouton-etape-identifiant')).click();
        await settle(page);
        await closeBanner(page);
      }

      await (await find('login-champ-mot-de-passe')).fill(secrets.password);
      await (await find('login-bouton-connexion')).click();
      await settle(page);
      await closeBanner(page);

      // Un champ mot de passe encore visible = connexion refusée (identifiants invalides, 2FA...).
      if (await page.locator(getSelector(selectors, 'login-champ-mot-de-passe')).first().isVisible().catch(() => false)) {
        throw new Error('Connexion refusée : formulaire toujours affiché (identifiants ou étape en plus)');
      }
    }

    // --- Établissement de la session : réutilisation, sinon connexion automatique, sinon repli manuel ---
    const storagePath = authStatePath(scope);
    let loginPath = null;
    try { if (loginUrl && new URL(loginUrl).pathname !== new URL(url).pathname) loginPath = new URL(loginUrl).pathname; } catch { /* URL illisible */ }
    const passwordSelector = selectors.map['login-champ-mot-de-passe'];
    let atStart = false; // vrai si la page est déjà sur l'URL principale (validation de session)
    const open = async (storageState) => {
      context = await browser.newContext({ ...contextOptions, ...(storageState ? { storageState } : {}) });
      page = await context.newPage();
    };

    if (useWindow) {
      // Fenêtre partagée : aucune connexion ni storageState ; on valide seulement que la fenêtre est connectée.
      context = browser.contexts()[0];
      if (!context) throw new Error('Fenêtre partagée sans contexte navigateur : la relancer avec « node src/recette-window.mjs start ».');
      page = await context.newPage();
      if (loginUrl) {
        try {
          await gotoOn(page, url);
        } catch (err) {
          throw new Error(`Fenêtre partagée : navigation impossible : ${sanitizeErrorMessage(err.message)}`);
        }
        atStart = true;
        if (await looksLoggedOut(page, { passwordSelector, loginPath })) {
          throw new Error(`Fenêtre partagée non connectée (${scope}) : se connecter dans la fenêtre (2FA/SSO compris), puis relancer.`);
        }
        console.log(`Session web (${scope}) : fenêtre partagée (session de la fenêtre).`);
      }
    } else if (!loginUrl) {
      await open(); // Front anonyme
    } else {
      let reused = false;
      if (existsSync(storagePath)) {
        let opened = false;
        try { await open(storagePath); opened = true; } catch { /* fichier de session illisible : traité comme invalide */ }
        if (opened) {
          try {
            await gotoOn(page, url);
          } catch (err) {
            throw new Error(`Connexion impossible : ${sanitizeErrorMessage(err.message)}`);
          }
          if (await looksLoggedOut(page, { passwordSelector, loginPath })) {
            console.log(`Session web (${scope}) : session sauvegardée expirée, reconnexion.`);
            await context.close().catch(() => {});
          } else {
            reused = true;
            atStart = true;
            console.log(`Session web (${scope}) : session sauvegardée réutilisée.`);
          }
        }
      }
      if (!reused) {
        await open();
        try {
          await login(page);
          await saveStorageState(context, storagePath);
          console.log(`Session web (${scope}) : connexion automatique, session sauvegardée.`);
        } catch (err) {
          const manualPossible = hasDisplay() && manualFallbackEnabled();
          // Sélecteur de connexion introuvable (typiquement un écran SSO à la place du formulaire) : repli manuel
          // direct si possible ; sinon heal du fichier de sélecteurs (comportement historique).
          if (err instanceof SelectorNotFoundError && !manualPossible) throw err;
          const cause = (err instanceof SelectorNotFoundError
            ? 'page de connexion différente de celle attendue (SSO ?)'
            : sanitizeErrorMessage(err.message).replace(/^Connexion impossible : /, '')).slice(0, 80);
          if (manualPossible) {
            console.log(`Session web (${scope}) : connexion automatique impossible, ouverture d'une fenêtre de connexion manuelle.`);
            await context.close().catch(() => {});
            try {
              await runManualLogin({ url: loginUrl, storagePath, httpCredentials });
            } catch (manualErr) {
              throw new Error(`Connexion impossible : ${sanitizeErrorMessage(manualErr.message === 'manual-login-timeout' ? 'connexion manuelle non détectée avant le délai (RECETTE_LOGIN_DONE_URL_PATTERN / RECETTE_LOGIN_DONE_SELECTOR ?)' : manualErr.message)}`);
            }
            await open(storagePath);
            console.log(`Session web (${scope}) : session manuelle sauvegardée.`);
          } else {
            throw new Error(`Connexion impossible : ${cause}. Connexion manuelle indisponible (affichage absent ou repli désactivé) : lancer « node src/login-preprod.mjs ${scope} --manuel » avec affichage, puis relancer.`);
          }
        }
      }
    }

    // Point de départ de la recette : l'URL principale, avec la session établie par les cookies du contexte.
    if (!atStart) await gotoOn(page, url);

    const screenshotOn = (targetPage) => async (name) => {
      const safeName = assertSafeFileName(name, 'screenshot : nom'); // refus clair plutôt qu'une écriture hors outputs/screenshots
      if (isBo) return null; // règle de sécurité : jamais de capture d'une page du back-office
      const p = path.join(SCREENSHOT_DIR, `${safeName}.png`);
      await targetPage.screenshot({ path: p, fullPage: false }).catch(() => {});
      return p;
    };

    // Nouveau contexte du même navigateur (= nouvelle fenêtre en mode visible), SANS nouvelle connexion : initialisé avec les
    // cookies/stockage de la session principale. Sert à la session « isolée » (cas de bord à état propre, `cloneIsolated`) et à
    // `openVariant` ci-dessous. `device` : desktop | mobile ; `baseUrl` : autre site (ex. site local de la recette : l'hôte reste
    // soumis au contrôle des hôtes autorisés ; ni cookies ni identifiants du site principal ne lui sont transmis).
    // `navigate: false` : ne pas ouvrir l'accueil à la création. Même API que la session principale ; close() ferme ce contexte.
    async function createVariant({ device = 'desktop', geolocation, baseUrl, navigate = true } = {}) {
      if (!DEVICES[device]) throw new Error(`Appareil inconnu : ${device} (attendu : ${Object.keys(DEVICES).join(', ')})`);
      const startUrl = baseUrl || url;
      const origin = new URL(startUrl).origin;
      assertPreprod(startUrl, `config/${scope}/site`);
      const storageState = baseUrl ? null : await context.storageState();
      const varContext = await browser.newContext({
        ...(baseUrl ? {} : contextOptions),
        ...DEVICES[device],
        ...(geolocation ? { geolocation, permissions: ['geolocation'] } : DEFAULT_GEO),
        ...(storageState ? { storageState } : {}),
      });
      const varPage = await varContext.newPage();
      const varGoto = (pathOrUrl) => gotoOn(varPage, pathOrUrl, origin);
      if (navigate) await varGoto(startUrl);
      return {
        browser, context: varContext, page: varPage, baseUrl: origin, selectors, device,
        goto: varGoto, gotoHome: () => varGoto(startUrl),
        expectSelector: (locator, opts = {}) => expectSelectorShared(varPage, locator, { scope, ...(isBo ? { screenshot: false } : {}), ...opts }),
        screenshot: screenshotOn(varPage),
        capture: createCapture({ page: varPage, browser, scope, isBo }),
        close: () => varContext.close(),
        // Un step isolé reçoit une variante : les scénarios smartphone doivent pouvoir en ouvrir d'autres.
        ...(isBo ? {} : { openVariant }),
      };
    }
    const cloneIsolated = () => createVariant();

    // Le moins de fenêtres possible (une session par run) : l'écran d'ordinateur est la session principale elle-même ; chaque autre
    // appareil ou site (smartphone, site local) n'ouvre qu'UN contexte, réutilisé par tous les scénarios et fermé en fin de run
    // (close() d'une variante rendue par openVariant ne fait donc rien). Le scénario recharge l'accueil lui-même.
    const variants = new Map();
    let mainSession;
    async function openVariant({ device = 'desktop', geolocation, baseUrl, navigate = true } = {}) {
      if (device === 'desktop' && !baseUrl) {
        if (navigate) await mainSession.gotoHome();
        return mainSession;
      }
      const key = `${device}|${baseUrl ?? ''}`;
      let variant = variants.get(key);
      if (!variant) {
        // Toute fenêtre supplémentaire est annoncée (une seule par appareil ou site, réutilisée ensuite).
        console.log(`  🪟 Fenêtre supplémentaire ouverte : ${baseUrl ? 'site local de la recette' : `appareil « ${device} » (écran tactile simulé)`}`);
        const created = await createVariant({ device, geolocation, baseUrl, navigate: false });
        variant = { ...created, closeNow: created.close, close: async () => {} };
        variants.set(key, variant);
      }
      if (navigate) await variant.gotoHome();
      return variant;
    }

    mainSession = {
      browser, context, page, baseUrl: sessionOrigin, selectors, scope, sharedWindow: useWindow,
      goto: (pathOrUrl) => gotoOn(page, pathOrUrl),
      gotoHome: () => gotoOn(page, url),
      expectSelector: (locator, opts = {}) => expectSelectorShared(page, locator, { scope, ...(isBo ? { screenshot: false } : {}), ...opts }),
      screenshot: screenshotOn(page),
      // Capture de preuve (bandeau hors DOM, masquage, refus BO/login/paiement) : voir tests/web/lib/capture.js.
      capture: createCapture({ page, browser, scope, isBo }),
      close: async () => {
        for (const v of variants.values()) await v.closeNow().catch(() => {});
        // Fenêtre partagée : jamais context.close()/browser.close() (cela fermerait la fenêtre de l'utilisateur).
        if (useWindow) { await page.close().catch(() => {}); return; }
        await context.close(); await browser.close();
      },
      // Contexte isolé : réservé au Front (cas de bord à état propre) ; le back-office n'en a jamais besoin.
      ...(isBo ? {} : { cloneIsolated, openVariant }),
    };
    return mainSession;
  } catch (err) {
    if (useWindow) await page?.close().catch(() => {}); // la fenêtre partagée reste ouverte
    else await browser.close().catch(() => {});
    throw err;
  }
}
