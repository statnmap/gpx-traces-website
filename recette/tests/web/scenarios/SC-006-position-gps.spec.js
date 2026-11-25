// Source: config/front/scenarios.md#SC-006
import { appApi, loadHomeWithTraces, appears, disappears } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-006',
  title: 'Afficher et masquer sa position GPS (ordinateur)',
  priority: 'moyenne',
  category: 'carte',
};

export async function run({ session, selectors, addStep }) {
  // La session a la localisation autorisée et une position simulée dans la zone de la carte (tests/web/lib/session.js).
  const { sel, loc, must } = appApi(session, selectors, meta.id);
  await loadHomeWithTraces(session, selectors);
  const button = await must('bouton-gps');

  await button.click();
  const shown = await appears(loc('marqueur-gps'), 8000);
  addStep(shown, 'Un repère de position apparaît sur la carte');
  // L'image se charge après l'apparition du repère : attendre un peu avant de conclure qu'elle est cassée.
  const loaded = shown && (await session.page
    .waitForFunction((s) => { const img = document.querySelector(s); return Boolean(img && img.complete && img.naturalWidth > 0); }, sel('marqueur-gps'), { timeout: 8000 })
    .then(() => true)
    .catch(() => false));
  addStep(loaded, "L'image du repère est chargée (le repère n'est pas cassé)");
  addStep(/masquer/i.test((await button.textContent()) ?? ''), 'Le bouton propose de masquer la position');

  await button.click();
  addStep(await disappears(loc('marqueur-gps')), 'Au second clic, le repère disparaît');
  addStep(/afficher/i.test((await button.textContent()) ?? ''), "Le bouton propose de nouveau d'afficher la position");
}
