/**
 * Parseur de config/<scope>/selectors.md — dictionnaire
 * nom-clé → sélecteur CSS. Ne lit que la table "## Sélecteurs CSS" (les sélecteurs Playwright role-based d'une
 * éventuelle table "## Sélecteurs Playwright" ne sont pas consommés par les specs autonomes — à ajouter si
 * un scénario en a besoin). `scope` vaut `front` ou `backoffice`.
 */
import { readFileSync, existsSync } from 'fs';

function extractSection(content, heading) {
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (startIdx === -1) return [];
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith('## '));
  return endIdx === -1 ? rest : rest.slice(0, endIdx);
}

function parseTable(lines) {
  const map = {};
  for (const line of lines) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|/);
    if (!m) continue;
    const key = m[1].trim();
    if (key === 'Nom clé' || /^-+$/.test(key)) continue;
    map[key] = m[2].trim().replace(/^`|`$/g, '');
  }
  return map;
}

/** Chemin du fichier de sélecteurs d'un scope. */
export function resolveSelectorsPath(scope = 'front') {
  return `config/${scope}/selectors.md`;
}

/** Charge les sélecteurs CSS connus d'un scope. Lève si le fichier est absent. */
export function loadSelectors({ scope = 'front' } = {}) {
  const filePath = resolveSelectorsPath(scope);
  if (!existsSync(filePath)) throw new Error(`[selectors] ${filePath} introuvable (créer depuis config/${scope}/selectors.example.md)`);
  const content = readFileSync(filePath, 'utf8');
  return { map: parseTable(extractSection(content, 'Sélecteurs CSS')), filePath };
}

/** Retourne le sélecteur pour `key`, ou lève une erreur explicite s'il est absent du fichier. */
export function getSelector({ map, filePath }, key) {
  const value = map[key];
  if (!value) throw new Error(`[selectors] Clé "${key}" absente de ${filePath}`);
  return value;
}

/**
 * Éléments à masquer pendant les captures de preuve (`session.capture`) : section « ## Masquer aux captures » de
 * config/<scope>/selectors.md, une puce par élément, sélecteur CSS entre apostrophes inversées en premier
 * (`- \`#barre-debug\` — raison`). Section absente ou fichier absent : liste vide.
 */
export function loadMaskSelectors({ scope = 'front' } = {}) {
  const filePath = resolveSelectorsPath(scope);
  if (!existsSync(filePath)) return [];
  const lines = extractSection(readFileSync(filePath, 'utf8'), 'Masquer aux captures');
  return lines
    .map((l) => l.match(/^\s*[-*]\s+`([^`]+)`/))
    .filter(Boolean)
    .map((m) => m[1].trim());
}
