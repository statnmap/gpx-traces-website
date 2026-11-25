// Source: config/front/scenarios.md#SC-003
import { appApi, loadHomeWithTraces, findTracePoint, appears, disappears } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-003',
  title: "Ouverture et fermeture de la fenêtre d'une trace (ordinateur)",
  priority: 'haute',
  category: 'carte',
};

export async function run({ session, selectors, addStep }) {
  const { loc } = appApi(session, selectors, meta.id);
  const traces = await loadHomeWithTraces(session, selectors);
  const point = await findTracePoint(session.page, selectors);
  addStep(Boolean(point), 'Une trace est visible dans la carte');
  if (!point) return;

  const trace = loc('trace').nth(point.index);
  const baseColor = await trace.getAttribute('stroke');

  await session.page.mouse.click(point.x, point.y);
  const opened = await appears(loc('popup'));
  const popupText = opened ? await loc('popup').first().innerText() : '';
  addStep(opened && popupText.includes(traces[point.index]?.name ?? '\0'), 'Au clic, une fenêtre s\'ouvre avec le nom de la trace');
  addStep(await appears(loc('popup-telechargement')), 'La fenêtre propose un lien de téléchargement');

  await session.page.mouse.move(5, 5);
  addStep((await trace.getAttribute('stroke')) === 'red', 'La trace reste en rouge tant que la fenêtre est ouverte, souris éloignée');

  await loc('popup-fermer').first().click();
  addStep(await disappears(loc('popup')), 'La fenêtre se ferme avec sa croix');
  addStep((await trace.getAttribute('stroke')) === baseColor, 'À la fermeture, la trace retrouve sa couleur');
}
