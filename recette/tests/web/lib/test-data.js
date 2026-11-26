/**
 * Données créées par les scénarios : un seul endroit pour les fabriquer, avec un suffixe de traçabilité
 * `recette-AAAAMMJJ-n` qui permet de retrouver (et de nettoyer) ce qu'une recette a laissé dans l'environnement.
 *
 * Ne jamais écrire une valeur de test en dur dans une spec : passer par `testValue(...)`. Aucune donnée réelle
 * (nom, e-mail, téléphone d'une vraie personne) ; les valeurs fictives du projet vivent dans ce helper, pas dans les specs.
 *
 * SONDER LA VALIDATION D'UN CHAMP avant d'y compter : saisir (sans soumettre) une valeur longue, avec accents, espaces,
 * apostrophes ou « + », lire le message de validation, puis reporter la limite constatée dans `limits` ci-dessous ou
 * dans l'appel (`maxLength`, `allowed`). Un champ qui refuse le suffixe (tiret, point...) se règle ici, pas dans chaque spec.
 */

let counter = 0;

/** AAAAMMJJ du jour (heure locale). */
function today() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** Suffixe de traçabilité `recette-AAAAMMJJ-n` ; `n` s'incrémente à chaque appel dans un même run (RECETTE_RUN_INDEX = départ, défaut 1). */
export function traceSuffix() {
  counter += 1;
  const start = Number(process.env.RECETTE_RUN_INDEX) || 1;
  return `recette-${today()}-${start + counter - 1}`;
}

/**
 * Valeur de test tracée : `<base>-recette-AAAAMMJJ-n`, tronquée sur la BASE (jamais sur le suffixe) pour tenir dans
 * `maxLength`. `allowed` : expression régulière des caractères permis dans le champ (les autres sont remplacés par « - »).
 * Exemple : testValue('article', { maxLength: 30 }) → `article-recette-20261014-1`.
 */
export function testValue(base, { maxLength = 255, allowed = /[A-Za-z0-9-]/ } = {}) {
  const suffix = traceSuffix();
  const clean = [...String(base)].map((c) => (allowed.test(c) ? c : '-')).join('');
  const room = maxLength - suffix.length - 1;
  if (room < 1) throw new Error(`testValue : maxLength ${maxLength} trop court pour le suffixe de traçabilité (${suffix.length + 2} caractères minimum).`);
  return `${clean.slice(0, room)}-${suffix}`;
}
