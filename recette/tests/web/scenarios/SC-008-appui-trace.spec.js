// Source: config/front/scenarios.md#SC-008
import { appApi, loadHomeWithTraces, findTracePoint, appears, disappears } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-008',
  title: 'Appui sur une trace (smartphone)',
  priority: 'haute',
  category: 'carte',
};

export async function run({ session, selectors, addStep }) {
  const phone = await session.openVariant({ device: 'mobile', navigate: false });
  try {
    const { loc } = appApi(phone, selectors, meta.id);
    const traces = await loadHomeWithTraces(phone, selectors);
    const point = await findTracePoint(phone.page, selectors);
    addStep(Boolean(point), 'Une trace est visible dans la carte');
    if (!point) return;

    const trace = loc('trace').nth(point.index);
    const baseColor = await trace.getAttribute('stroke');

    await phone.page.touchscreen.tap(point.x, point.y);
    const opened = await appears(loc('popup'));
    const popupText = opened ? await loc('popup').first().innerText() : '';
    addStep(opened && popupText.includes(traces[point.index]?.name ?? '\0'), "Au toucher, une fenêtre s'ouvre avec le nom de la trace");
    addStep(await appears(loc('popup-telechargement')), 'La fenêtre propose un lien de téléchargement');
    addStep((await trace.getAttribute('stroke')) === 'red', 'La trace passe en rouge');
    addStep((await loc('infobulle').count()) === 0, "Aucune infobulle (pas de survol au toucher)");

    await loc('popup-fermer').first().tap();
    addStep(await disappears(loc('popup')), 'La fenêtre se ferme avec sa croix');
    addStep((await trace.getAttribute('stroke')) === baseColor, 'À la fermeture, la trace retrouve sa couleur');
  } finally {
    await phone.close();
  }
}
