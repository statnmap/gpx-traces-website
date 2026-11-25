// Source: config/front/scenarios.md#SC-001
import { appApi, watchPageErrors, loadHomeWithTraces } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-001',
  title: "La carte et les traces s'affichent (ordinateur)",
  priority: 'haute',
  category: 'carte',
};

export async function run({ session, selectors, addStep }) {
  const { loc, must } = appApi(session, selectors, meta.id);
  const errors = watchPageErrors(session.page);
  const traces = await loadHomeWithTraces(session, selectors);

  await must('accueil-titre');
  addStep(true, 'Le titre de la page est affiché');

  await must('carte');
  const stylesLoaded = await loc('carte-panneau').first().evaluate((el) => getComputedStyle(el).position === 'absolute').catch(() => false);
  addStep(stylesLoaded, 'La carte est affichée correctement (styles chargés)');

  const drawn = await loc('trace').count();
  addStep(traces.length > 0 && drawn === traces.length, `Autant de traces sont dessinées que dans le fichier de traces (${drawn}/${traces.length}, au moins une)`);

  const filters = await loc('filtre-categorie').count();
  addStep(filters > 0 && (await loc('filtre-categorie').first().isVisible()), `Les cases de filtres sont visibles (${filters} catégorie(s))`);

  addStep(errors.length === 0, errors.length ? `Erreur(s) de page : ${errors.join(' | ')}` : "La page ne signale aucune erreur (sinon filtres ou téléchargement pourraient être cassés)");

  await session.capture(meta.id, 'carte-ordinateur');
}
