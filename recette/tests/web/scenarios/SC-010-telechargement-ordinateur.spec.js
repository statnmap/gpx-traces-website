// Source: config/front/scenarios.md#SC-010
import { appApi, loadHomeWithTraces, findTracePoint, appears, readDownload, looksLikeGpx, startsLikeTrace } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-010',
  title: "Télécharger le GPX d'une trace (ordinateur)",
  priority: 'haute',
  category: 'téléchargement',
};

export async function run({ session, selectors, addStep }) {
  const { loc } = appApi(session, selectors, meta.id);
  const traces = await loadHomeWithTraces(session, selectors);
  const point = await findTracePoint(session.page, selectors);
  addStep(Boolean(point), 'Une trace est visible dans la carte');
  if (!point) return;

  await session.page.mouse.click(point.x, point.y);
  const linkShown = await appears(loc('popup-telechargement'));
  addStep(linkShown, 'La fenêtre de la trace propose le lien de téléchargement');
  if (!linkShown) return;

  const [download] = await Promise.all([
    session.page.waitForEvent('download', { timeout: 15000 }),
    loc('popup-telechargement').first().click(),
  ]);
  const name = download.suggestedFilename();
  const expectedName = `${traces[point.index]?.sanitizedName}.gpx`;
  addStep(name.endsWith('.gpx') && name === expectedName, `Un fichier se télécharge, son nom se termine par .gpx et correspond à la trace (${name})`);
  const content = await readDownload(download);
  addStep(looksLikeGpx(content), 'Le fichier est un GPX exploitable (balise GPX et au moins un point de trace)');
  addStep(startsLikeTrace(content, traces[point.index]), 'Le fichier est bien celui de la trace choisie : son premier point est le début de la trace affichée');
}
