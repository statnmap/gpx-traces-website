// Source: config/front/scenarios.md#SC-014
import { appApi } from '../lib/gpx-app.js';

export const meta = {
  id: 'SC-014',
  title: 'Fichier de traces indisponible (ordinateur)',
  priority: 'moyenne',
  category: 'indisponibilité',
};

// Texte qui, affiché à la personne, lui dit que quelque chose n'est pas disponible. Aucun sélecteur : on lit ce qu'elle lit.
const UNAVAILABLE = /indisponible|unavailable|erreur|error|impossible|échec|echec|failed|could not|couldn't|réessay|try again/i;

export async function run({ session, selectors, addStep }) {
  const { loc, must } = appApi(session, selectors, meta.id);
  const ROUTE = /traces\.json/;
  // Seule la vue de la recette est touchée : la requête du fichier de traces échoue dans ce navigateur, rien n'est changé sur le site.
  await session.page.route(ROUTE, (route) => route.abort('failed'));
  try {
    await session.gotoHome();
    await session.page.waitForTimeout(1500); // laisser à la page le temps de constater l'échec du chargement
    await must('carte');
    addStep(true, 'La carte reste affichée');
    const drawn = await loc('trace').count();
    addStep(drawn === 0, `Aucune trace n'est dessinée, le fichier étant indisponible (${drawn})`);
    const visibleText = await session.page.locator('body').innerText();
    addStep(UNAVAILABLE.test(visibleText), "Un message explique à la personne que les traces sont indisponibles (au lieu d'une carte vide sans explication)");
  } finally {
    await session.page.unroute(ROUTE);
  }
}
