// Source: config/front/scenarios.md#SC-002
import { appApi, loadHomeWithTraces, findTracePoint, appears, disappears } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-002',
  title: "Survol d'une trace (ordinateur)",
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

  await session.page.mouse.move(point.x, point.y);
  const tooltipShown = await appears(loc('infobulle'));
  const tooltipText = tooltipShown ? await loc('infobulle').first().innerText() : '';
  addStep(tooltipShown && tooltipText.includes(traces[point.index]?.name ?? '\0'), "Au survol, une infobulle affiche le nom de la trace");
  addStep((await trace.getAttribute('stroke')) === 'red', 'Au survol, la trace passe en rouge');

  await session.page.mouse.move(5, 5);
  addStep(await disappears(loc('infobulle')), "En éloignant la souris, l'infobulle disparaît");
  addStep((await trace.getAttribute('stroke')) === baseColor, 'En éloignant la souris, la trace retrouve sa couleur');
}
