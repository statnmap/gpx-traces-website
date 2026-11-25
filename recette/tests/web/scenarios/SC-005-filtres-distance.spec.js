// Source: config/front/scenarios.md#SC-005
import { appApi, loadHomeWithTraces, expectedDistanceClass } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-005',
  title: 'Filtrer les parcours par distance (ordinateur)',
  priority: 'moyenne',
  category: 'filtre',
};

export async function run({ session, selectors, addStep }) {
  const { sel, loc } = appApi(session, selectors, meta.id);
  const traces = await loadHomeWithTraces(session, selectors);
  const parcours = traces.filter((t) => t.category === 'parcours');
  const classOf = (t) => expectedDistanceClass(t.distanceKm);

  const hasUnknown = parcours.some((t) => classOf(t) === 'unknown');
  addStep((await loc('distance-inconnue').isVisible()) === hasUnknown, `La case « distance inconnue » est ${hasUnknown ? 'proposée' : 'absente'} (parcours sans distance : ${hasUnknown ? 'oui' : 'non'})`);

  const boxes = [];
  for (const box of await loc('filtre-distance').all()) {
    if (await box.isVisible()) boxes.push({ box, value: await box.evaluate((e) => e.value) });
  }
  addStep(boxes.length >= 3, `Les distances sont proposées (${boxes.length} case(s))`);

  for (const { box, value } of boxes) {
    const expected = parcours.filter((t) => classOf(t) === value).length;
    await box.uncheck();
    const hidden = traces.length - (await loc('trace').count());
    await box.check();
    const shown = await loc('trace').count();
    addStep(hidden === expected && shown === traces.length, `Distance « ${value} » : décocher masque ${expected} parcours, recocher réaffiche tout`);
  }

  for (const { box } of boxes) await box.uncheck();
  addStep((await loc('trace').count()) === traces.length - parcours.length, `Tout décocher masque les ${parcours.length} parcours et seulement eux`);
  for (const { box } of boxes) await box.check();

  const parcoursBox = session.page.locator(`${sel('filtre-categorie')}[value="parcours"]`);
  await parcoursBox.uncheck();
  addStep(await session.page.locator(`${sel('filtres-distance')}.disabled`).isVisible(), 'Parcours masqués : les filtres de distance sont grisés');
  await parcoursBox.check();
}
