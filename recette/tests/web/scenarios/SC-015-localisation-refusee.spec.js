// Source: config/front/scenarios.md#SC-015
import { appApi, loadHomeWithTraces } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-015',
  title: 'Localisation refusée (ordinateur)',
  priority: 'moyenne',
  category: 'carte',
};

export async function run({ session, selectors, addStep }) {
  const { loc, must } = appApi(session, selectors, meta.id);
  await loadHomeWithTraces(session, selectors);
  const button = await must('bouton-gps');
  const labelBefore = ((await button.textContent()) ?? '').trim();

  // Refus simulé comme un navigateur le signale (code 1 : permission refusée), sur la page courante seulement :
  // le prochain chargement de la page retrouve le comportement normal.
  await session.page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) => setTimeout(() => fail && fail({ code: 1, message: 'User denied Geolocation' }), 0);
  });
  let dialogSeen = false;
  session.page.once('dialog', (d) => { dialogSeen = true; d.dismiss().catch(() => {}); });
  const textBefore = await session.page.locator('body').innerText();

  await button.click();
  await session.page.waitForTimeout(1500);

  const textAfter = await session.page.locator('body').innerText();
  const labelAfter = ((await button.textContent()) ?? '').trim();
  addStep(
    dialogSeen || textAfter !== textBefore,
    "La personne est informée que sa position n'est pas disponible (message affiché), au lieu d'un bouton qui ne réagit pas",
  );
  addStep((await loc('marqueur-gps').count()) === 0 && !/masquer/i.test(labelAfter), `Le bouton n'annonce pas une position affichée alors qu'il n'y en a pas (« ${labelBefore} » → « ${labelAfter} »)`);
}
