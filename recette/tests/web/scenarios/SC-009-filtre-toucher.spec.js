// Source: config/front/scenarios.md#SC-009
import { appApi, loadHomeWithTraces } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-009',
  title: 'Filtrer au toucher (smartphone)',
  priority: 'moyenne',
  category: 'filtre',
};

export async function run({ session, selectors, addStep }) {
  const phone = await session.openVariant({ device: 'mobile', navigate: false });
  try {
    const { sel, loc } = appApi(phone, selectors, meta.id);
    const traces = await loadHomeWithTraces(phone, selectors);
    const values = await loc('filtre-categorie').evaluateAll((els) => els.map((e) => e.value));
    // Catégorie qui contient des traces si possible : le masquage est alors observable.
    const category = values.find((v) => traces.some((t) => t.category === v)) ?? values[0];
    addStep(Boolean(category), 'Une catégorie est proposée');
    if (!category) return;

    const box = phone.page.locator(`${sel('filtre-categorie')}[value="${category}"]`);
    const expected = traces.filter((t) => t.category === category).length;

    await box.tap();
    addStep(!(await box.isChecked()), 'Un appui décoche la case');
    addStep(traces.length - (await loc('trace').count()) === expected, `Les ${expected} trace(s) de la catégorie sont masquées`);

    await box.tap();
    addStep(await box.isChecked(), 'Un second appui recoche la case');
    addStep((await loc('trace').count()) === traces.length, 'Toutes les traces sont réaffichées');
  } finally {
    await phone.close();
  }
}
