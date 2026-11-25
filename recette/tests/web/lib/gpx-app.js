/**
 * Outils communs aux scénarios de la carte de traces GPX. Tout se fait « comme l'utilisateur » : on ouvre la page,
 * on regarde la carte, on survole, on clique ou on touche, on télécharge. Les données attendues (nombre de traces par
 * catégorie, distances) viennent du fichier de traces servi à la page elle-même, jamais d'une valeur en dur.
 *
 * `s` désigne une session ou une variante (voir `session.openVariant`) : tout objet exposant `page`, `gotoHome`
 * et `expectSelector`.
 */
import { readFile } from 'node:fs/promises';
import { getSelector } from './selectors.js';

/**
 * Raccourcis sur les sélecteurs de `config/front/selectors.md` pour un scénario.
 * - `sel(key)` : sélecteur CSS ; `loc(key)` : locator ; `must(key)` : le même, après vérification qu'il est visible
 *   (introuvable → SelectorNotFoundError → heal, ne jamais l'attraper).
 */
export function appApi(s, selectors, scenario) {
  const sel = (key) => getSelector(selectors, key);
  const loc = (key) => s.page.locator(sel(key));
  const must = async (key) => {
    await s.expectSelector(loc(key), { key, selector: sel(key), source: `${selectors.filePath}#${key}`, scenario });
    return loc(key);
  };
  return { sel, loc, must };
}

/** Erreurs JavaScript de la page (à brancher AVANT le chargement). Tuiles de carte et favicon exclus : tiers. */
export function watchPageErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('dialog', (d) => { errors.push(`boîte de dialogue inattendue (${d.type()})`); d.dismiss().catch(() => {}); });
  return errors;
}

/**
 * Ouvre l'accueil, attend que les traces soient dessinées et retourne les traces du fichier de données
 * (le même que celui lu par la page). Rien n'est supposé sur leur nombre.
 */
export async function loadHomeWithTraces(s, selectors) {
  const dataPromise = s.page
    .waitForResponse((r) => /traces\.json$/.test(new URL(r.url()).pathname), { timeout: 30000 })
    .then((r) => r.json());
  dataPromise.catch(() => {}); // évite un rejet non géré si la navigation échoue avant
  await s.gotoHome();
  const data = await dataPromise;
  const traces = data.traces ?? [];
  if (traces.length > 0) {
    await s.page.locator(getSelector(selectors, 'trace')).first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
  }
  return traces;
}

/** Distance attendue d'un parcours, écrite ici indépendamment de l'application : < 8 km, 8 à < 10 km, ≥ 10 km, inconnue. */
export function expectedDistanceClass(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return 'unknown';
  if (distanceKm < 8) return 'lt8';
  if (distanceKm < 10) return '8to10';
  return 'gte10';
}

/**
 * Cherche un point d'une trace réellement visible dans la carte (là où elle est dessinée au-dessus des autres) et
 * retourne ses coordonnées d'écran et l'indice de la trace, ou null. Plusieurs points de chaque trace sont essayés.
 * `onlyIndex` : ne chercher que sur la trace d'indice donné (l'ordre des traces suit celui du fichier de traces).
 */
export function findTracePoint(page, selectors, onlyIndex = null) {
  const mapSel = getSelector(selectors, 'carte');
  const pathSel = getSelector(selectors, 'trace');
  return page.evaluate(({ mapSel, pathSel, onlyIndex }) => {
    const map = document.querySelector(mapSel).getBoundingClientRect();
    const paths = [...document.querySelectorAll(pathSel)];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fractions = [0.5, 0.25, 0.75, 0.1, 0.9, 0.35, 0.65, 0.2, 0.8, 0.4, 0.6];
    for (let index = 0; index < paths.length; index++) {
      if (onlyIndex !== null && index !== onlyIndex) continue;
      const path = paths[index];
      const total = path.getTotalLength();
      const m = path.getScreenCTM();
      for (const f of fractions) {
        const p = path.getPointAtLength(total * f);
        const x = p.x * m.a + p.y * m.c + m.e;
        const y = p.x * m.b + p.y * m.d + m.f;
        if (x > Math.max(map.left, 0) + 20 && x < Math.min(map.right, vw) - 20 && y > Math.max(map.top, 0) + 20 && y < Math.min(map.bottom, vh) - 20) {
          // Les traces peuvent se chevaucher : garder celle qui est réellement sous le point.
          const hit = paths.indexOf(document.elementFromPoint(x, y));
          if (hit >= 0 && (onlyIndex === null || hit === onlyIndex)) return { index: hit, x, y };
        }
      }
    }
    return null;
  }, { mapSel, pathSel, onlyIndex });
}

/** Vrai si l'élément devient visible (ou l'est déjà) dans le délai. */
export const appears = (locator, timeout = 3000) => locator.first().waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);

/** Vrai si l'élément est absent ou disparaît dans le délai. */
export const disappears = (locator, timeout = 3000) => locator.first().waitFor({ state: 'hidden', timeout }).then(() => true).catch(() => false);

/** Contenu d'un fichier téléchargé (objet Download de Playwright) : texte, sans jamais l'écrire dans outputs/. */
export async function readDownload(download) {
  const filePath = await download.path();
  return filePath ? readFile(filePath, 'utf8') : '';
}

/** Premier point de trace d'un fichier GPX ({ lat, lon }), ou null. Les attributs peuvent venir dans n'importe quel ordre. */
export function firstTrackPoint(text) {
  const tag = text.match(/<trkpt\s[^>]*>/)?.[0];
  if (!tag) return null;
  const lat = Number(tag.match(/\blat\s*=\s*["']([^"']+)["']/)?.[1]);
  const lon = Number(tag.match(/\blon\s*=\s*["']([^"']+)["']/)?.[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/**
 * Le fichier téléchargé est-il bien celui de la trace affichée ? Compare son premier point au début de la trace du fichier de
 * traces (tolérance 1e-4° ≈ 10 m : la trace affichée est simplifiée et reprojetée, ses extrémités sont conservées).
 */
export function startsLikeTrace(gpxText, trace) {
  const a = firstTrackPoint(gpxText);
  const b = trace?.coordinates?.[0];
  return Boolean(a && b) && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
}

/** Vrai si le texte ressemble à un fichier GPX exploitable : balise racine et au moins un point de trace. */
export function looksLikeGpx(text) {
  return /<gpx[\s>]/.test(text) && /<trkpt\s/.test(text);
}
