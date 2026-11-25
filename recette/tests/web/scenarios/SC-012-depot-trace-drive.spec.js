// Source: config/front/scenarios.md#SC-012
// Site LOCAL et Drive SIMULÉ (voir tests/web/lib/local-site.js) : jamais le site de RECETTE_URL.
import { appApi, loadHomeWithTraces, findTracePoint, appears, readDownload, looksLikeGpx, startsLikeTrace } from '../lib/gpx-app.js';
import { startLocalSite, DROPPED_TRACE } from '../lib/local-site.js';

export const meta = {
  id: 'SC-012',
  title: 'Une trace déposée sur le Drive apparaît sur le site (site local, Drive simulé)',
  priority: 'haute',
  category: 'publication',
};

export async function run({ session, selectors, addStep }) {
  const site = await startLocalSite();
  let local;
  try {
    local = await session.openVariant({ baseUrl: site.url, navigate: false });
    const { loc } = appApi(local, selectors, meta.id);

    const before = await loadHomeWithTraces(local, selectors);
    const drawnBefore = await loc('trace').count();
    addStep(before.length > 0 && drawnBefore === before.length, `Avant le dépôt, le site affiche les traces du Drive (${drawnBefore})`);
    addStep(!before.some((t) => t.name === DROPPED_TRACE.name), 'La trace à déposer n\'est pas encore affichée');

    site.dropOnDrive(DROPPED_TRACE.file);
    await site.publish();
    const after = await loadHomeWithTraces(local, selectors);
    const drawnAfter = await loc('trace').count();
    addStep(after.length === before.length + 1 && drawnAfter === after.length, `Après la publication, le site affiche une trace de plus (${drawnBefore} → ${drawnAfter})`);

    const index = after.findIndex((t) => t.name === DROPPED_TRACE.name);
    addStep(index >= 0, 'La nouvelle trace porte le nom du fichier déposé');
    addStep(before.every((t) => after.some((a) => a.sanitizedName === t.sanitizedName)), 'Les autres traces sont inchangées');
    if (index < 0) return;

    const point = await findTracePoint(local.page, selectors, index);
    addStep(Boolean(point), 'La nouvelle trace est visible dans la carte');
    if (!point) return;
    await local.page.mouse.click(point.x, point.y);
    const popup = await appears(loc('popup'));
    const popupText = popup ? await loc('popup').first().innerText() : '';
    addStep(popup && popupText.includes(DROPPED_TRACE.name), 'La nouvelle trace s\'ouvre dans une fenêtre à son nom');

    const [download] = await Promise.all([
      local.page.waitForEvent('download', { timeout: 15000 }),
      loc('popup-telechargement').first().click(),
    ]);
    addStep(download.suggestedFilename() === `${after[index].sanitizedName}.gpx`, `Le fichier téléchargé porte le nom de la trace (${download.suggestedFilename()})`);
    const content = await readDownload(download);
    addStep(looksLikeGpx(content), 'Le fichier téléchargé est un GPX exploitable');
    addStep(startsLikeTrace(content, after[index]), 'Son premier point est le début de la trace affichée');

    await local.capture(meta.id, 'trace-deposee');
  } finally {
    await local?.close();
    await site.stop();
  }
}
