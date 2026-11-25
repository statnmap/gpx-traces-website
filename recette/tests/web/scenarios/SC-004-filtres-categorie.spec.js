// Source: config/front/scenarios.md#SC-004
import { appApi, loadHomeWithTraces } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-004',
  title: 'Filtrer les traces par catégorie (ordinateur)',
  priority: 'haute',
  category: 'filtre',
};

export async function run({ session, selectors, addStep }) {
  const { sel, loc } = appApi(session, selectors, meta.id);
  const traces = await loadHomeWithTraces(session, selectors);
  const values = await loc('filtre-categorie').evaluateAll((els) => els.map((e) => e.value));
  addStep(values.length > 0 && traces.length > 0, `Des catégories sont proposées (${values.length}) et des traces sont affichées (${traces.length})`);

  for (const category of values) {
    const box = session.page.locator(`${sel('filtre-categorie')}[value="${category}"]`);
    const expected = traces.filter((t) => t.category === category).length;
    await box.uncheck();
    const hidden = traces.length - (await loc('trace').count());
    await box.check();
    const shown = await loc('trace').count();
    addStep(hidden === expected && shown === traces.length, `Catégorie « ${category} » : décocher masque ${expected} trace(s), recocher réaffiche tout`);
  }
}
