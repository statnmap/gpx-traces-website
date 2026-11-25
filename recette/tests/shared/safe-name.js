/**
 * Noms de fichiers de capture : jamais de chemin fourni par une spec. Un nom contenant `..`, `/`, `\`, un caractère
 * hors [A-Za-z0-9._-] ou vide pourrait écrire hors de outputs/screenshots/ : il est refusé avec une erreur claire.
 */
import path from 'node:path';

const VALID = /^[A-Za-z0-9._-]+$/;
const MAX_LENGTH = 120;

/** Retourne `name` s'il est un nom de fichier sûr (sans extension ajoutée), sinon lève une erreur explicite. */
export function assertSafeFileName(name, label = 'nom de capture') {
  const shown = JSON.stringify(String(name).slice(0, 40));
  if (typeof name !== 'string' || name.trim() === '') throw new Error(`${label} invalide : vide.`);
  if (name !== path.basename(name) || name.includes('/') || name.includes('\\')) {
    throw new Error(`${label} invalide ${shown} : un nom de fichier, pas un chemin (pas de « / » ni de « \\ »).`);
  }
  if (name.includes('..') || name.startsWith('.')) throw new Error(`${label} invalide ${shown} : « .. » et point initial interdits.`);
  if (!VALID.test(name)) throw new Error(`${label} invalide ${shown} : seuls A-Z a-z 0-9 . _ - sont autorisés.`);
  if (name.length > MAX_LENGTH) throw new Error(`${label} invalide : plus de ${MAX_LENGTH} caractères.`);
  return name;
}

/** Variante tolérante (chemin de heal, qui ne doit jamais échouer) : remplace tout caractère hors liste par « _ ». */
export function toSafeFileName(name, fallback = 'inconnu') {
  const cleaned = String(name ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '_').replace(/^\.+/, '_').slice(0, MAX_LENGTH);
  return cleaned || fallback;
}
