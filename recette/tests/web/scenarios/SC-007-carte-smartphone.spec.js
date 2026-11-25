// Source: config/front/scenarios.md#SC-007
import { appApi, watchPageErrors, loadHomeWithTraces } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-007',
  title: "La carte et les traces s'affichent (smartphone)",
  priority: 'haute',
  category: 'carte',
};

export async function run({ session, selectors, addStep }) {
  const phone = await session.openVariant({ device: 'mobile', navigate: false });
  try {
    const { loc, must } = appApi(phone, selectors, meta.id);
    const errors = watchPageErrors(phone.page);
    const traces = await loadHomeWithTraces(phone, selectors);

    await must('carte');
    const box = await loc('carte').boundingBox();
    const noHorizontalScroll = await phone.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    addStep(Boolean(box) && box.height >= 200 && box.width <= 390 && noHorizontalScroll, 'La carte est utilisable : taille suffisante, pas de défilement horizontal de la page');

    const drawn = await loc('trace').count();
    addStep(traces.length > 0 && drawn === traces.length, `Toutes les traces sont dessinées (${drawn}/${traces.length})`);

    await must('bouton-gps');
    addStep((await loc('filtre-categorie').count()) > 0 && (await loc('filtre-categorie').first().isVisible()), 'Les filtres et le bouton de position sont accessibles');

    addStep(errors.length === 0, errors.length ? `Erreur(s) de page : ${errors.join(' | ')}` : 'La page ne signale aucune erreur (sinon filtres ou téléchargement pourraient être cassés)');

    await phone.capture(meta.id, 'carte-smartphone');
  } finally {
    await phone.close();
  }
}
