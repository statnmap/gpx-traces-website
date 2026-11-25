// Source: config/front/scenarios.md#SC-011
import { appApi, loadHomeWithTraces, findTracePoint, appears, readDownload, looksLikeGpx, startsLikeTrace } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-011',
  title: "Télécharger le GPX d'une trace (smartphone)",
  priority: 'haute',
  category: 'téléchargement',
};

export async function run({ session, selectors, addStep }) {
  const phone = await session.openVariant({ device: 'mobile', navigate: false });
  try {
    const { loc } = appApi(phone, selectors, meta.id);
    const traces = await loadHomeWithTraces(phone, selectors);
    const point = await findTracePoint(phone.page, selectors);
    addStep(Boolean(point), 'Une trace est visible dans la carte');
    if (!point) return;

    await phone.page.touchscreen.tap(point.x, point.y);
    const linkShown = await appears(loc('popup-telechargement'));
    addStep(linkShown, 'La fenêtre de la trace propose le lien de téléchargement');
    if (!linkShown) return;

    const [download] = await Promise.all([
      phone.page.waitForEvent('download', { timeout: 15000 }),
      loc('popup-telechargement').first().tap(),
    ]);
    addStep(download.suggestedFilename().endsWith('.gpx'), `Un fichier se télécharge et son nom se termine par .gpx (${download.suggestedFilename()})`);
    const content = await readDownload(download);
    addStep(looksLikeGpx(content), 'Le fichier est un GPX exploitable');
    addStep(startsLikeTrace(content, traces[point.index]), 'Le fichier est bien celui de la trace choisie : son premier point est le début de la trace affichée');
  } finally {
    await phone.close();
  }
}
