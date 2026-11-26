// Source: config/front/scenarios.md#SC-013
// Site LOCAL et Drive SIMULÉ (voir tests/web/lib/local-site.js) : jamais le site de RECETTE_URL.
import { appApi, loadHomeWithTraces, expectedDistanceClass } from '../lib/gpx-app.js';
import { startLocalSite, DROPPED_TRACE } from '../lib/local-site.js';

export const meta = {
  id: 'SC-013',
  title: 'Une trace « parcours » déposée est classée selon sa distance (site local, Drive simulé)',
  priority: 'moyenne',
  category: 'publication',
};

export async function run({ session, selectors, addStep }) {
  const site = await startLocalSite();
  let local;
  try {
    local = await session.openVariant({ baseUrl: site.url, navigate: false });
    const { sel, loc } = appApi(local, selectors, meta.id);

    site.dropOnDrive(DROPPED_TRACE.file);
    await site.publish();
    const traces = await loadHomeWithTraces(local, selectors);
    const added = traces.find((t) => t.name === DROPPED_TRACE.name);
    addStep(Boolean(added), 'La trace déposée est affichée');
    if (!added) return;
    addStep(added.category === 'parcours' && expectedDistanceClass(added.distanceKm) === 'gte10', 'Elle est rangée dans les parcours « 10 km et plus », pas dans une autre catégorie');

    // Observable par l'utilisateur : la case « 10 km et plus » masque exactement les parcours de 10 km et plus, dont celle-ci.
    const expectedHidden = traces.filter((t) => t.category === 'parcours' && expectedDistanceClass(t.distanceKm) === 'gte10').length;
    const box = local.page.locator(`${sel('filtre-distance')}[value="gte10"]`);
    await box.uncheck();
    const hidden = traces.length - (await loc('trace').count());
    addStep(hidden === expectedHidden && expectedHidden >= 1, `Décocher « 10 km et plus » masque ${expectedHidden} parcours, dont la trace déposée`);
    await box.check();
    addStep((await loc('trace').count()) === traces.length, 'Recocher « 10 km et plus » réaffiche tout');
  } finally {
    await local?.close();
    await site.stop();
  }
}
