// Source: config/front/scenarios.md#SC-001
// Modèle de spec (jamais exécuté par le runner : les fichiers `*.example.*` sont ignorés). Pour l'utiliser,
// le copier en `SC-001-accueil.spec.js` (nom libre, suffixe `.spec.js` obligatoire) et l'adapter. Transcription
// du scénario « Page d'accueil visible » — voir tests/web/scenarios/README.md pour les règles.
import { getSelector } from '../lib/selectors.js';

// Métadonnées lues par le runner et reprises dans le rapport. `id` : `SC-…`.
export const meta = {
  id: 'SC-001',
  title: "Page d'accueil visible",
  priority: 'haute',
  category: 'navigation',
};

// `session` : navigateur déjà ouvert (et connecté si le Front a une URL de connexion) ; `selectors` : dictionnaire nom-clé → CSS.
export async function run({ session, selectors, addStep }) {
  await session.gotoHome();

  // Un sélecteur connu mais introuvable lève SelectorNotFoundError → le runner s'arrête (code 2) et le heal répare
  // la ligne dans config/front/selectors.md. Toujours passer par expectSelector pour ce qui doit exister.
  const titreSel = getSelector(selectors, 'accueil-titre');
  await session.expectSelector(session.page.locator(titreSel), {
    key: 'accueil-titre', selector: titreSel, source: `${selectors.filePath}#accueil-titre`, scenario: meta.id,
  });
  addStep(true, "Le titre principal de la page d'accueil est affiché");

  // Une assertion métier qui échoue (addStep(false, …)) marque le scénario ❌ mais n'arrête pas la recette.
  const nbTraces = await session.page.locator(getSelector(selectors, 'trace')).count();
  addStep(nbTraces > 0, `Au moins une trace est dessinée (${nbTraces} trouvée(s))`);

  // Preuve visuelle (facultative) : pleine page + bandeau hors DOM (hôte, horodatage, id), éléments de « Masquer aux captures »
  // masqués puis restaurés. Refusée (erreur claire) sur une page de connexion ou de saisie sensible et sur le back-office.
  await session.capture(meta.id, 'accueil'); // → outputs/screenshots/SC-001-accueil.png
}
