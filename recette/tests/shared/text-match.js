/**
 * Comparaison de libellés tolérante, réutilisable par toutes les specs : insensible à la
 * casse, aux accents (précomposés ou décomposés), aux apostrophes typographiques et aux espaces multiples.
 * Générique : aucune connaissance d'une application.
 */

/** Forme normalisée d'un texte : sans accents, apostrophes droites, espaces réduits, minuscules. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const VARIANTES = { a: 'aàâä', e: 'eéèêë', i: 'iîï', o: 'oôö', u: 'uùûü', c: 'cç', y: 'yÿ' };

/**
 * Expression régulière équivalente à un libellé (utilisable avec `locator.getByText(labelRegex('Mes commandes'))`) :
 * insensible à la casse, aux accents, aux apostrophes et aux espaces multiples. Le libellé est pris littéralement
 * (les caractères spéciaux de regex sont échappés).
 */
export function labelRegex(label) {
  const motif = norm(label).split('').map((ch) => {
    if (ch === ' ') return '\\s+';
    if (ch === "'") return "['’‘]";
    if (VARIANTES[ch]) return `[${VARIANTES[ch]}]\\p{M}*`;
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return new RegExp(motif, 'iu');
}

/** Vrai si `text` contient `label` (comparaison tolérante). */
export const includesLabel = (text, label) => norm(text).includes(norm(label));
