/**
 * Parseur de config/<scope>/parcours.md — extrait, pour un
 * parcours P-xxx donné, la séquence ordonnée de scénarios de chaque "Happy path" (SC + Bloquant ? + Vérif BO ? optionnelle)
 * ainsi que les "Cas de bord" (table à colonnes variables selon le parcours : Session isolée,
 * Vérif BO ?, Ordre recommandé). `scope` vaut `front` ou `backoffice` ; les identifiants de scénario
 * sont `SC-…` (front) ou `BO-…` (back-office).
 */
import { readFileSync } from 'fs';

const SC_ID = '(?:SC|BO)-[A-Za-z0-9-]+';
const YES = /^oui/i;
const YES_BO = /^(oui|facultatif)/i; // « facultatif » : BO disponible, vérification non obligatoire

function section(lines, startMarker, stopPrefixes) {
  const startIdx = lines.findIndex((l) => l.trim() === startMarker || l.trim().startsWith(startMarker));
  if (startIdx === -1) return null;
  const rest = lines.slice(startIdx + 1);
  const stopIdx = rest.findIndex((l) => stopPrefixes.some((p) => l.startsWith(p)));
  return stopIdx === -1 ? rest : rest.slice(0, stopIdx);
}

/**
 * Table d'un happy path : colonnes Ordre | SC | Checkpoint | Bloquant ? [| Vérif BO ?]. La colonne `Vérif BO ?`
 * est optionnelle ; `oui` (ou `facultatif`) rend le back-office disponible pour ce SC (scénario croisé).
 */
function parseHappyPathTable(lines) {
  const steps = [];
  const header = lines.find((l) => /^\|\s*Ordre\s*\|/i.test(l));
  const cols = header ? splitRow(header).map((c) => c.toLowerCase()) : [];
  const boIdx = cols.findIndex((c) => /^vérif bo/.test(c));
  for (const line of lines) {
    const cells = splitRow(line);
    if (cells.length < 4 || !/^\d+$/.test(cells[0]) || !new RegExp(`^${SC_ID}$`, 'i').test(cells[1]) || !/^(oui|non)$/i.test(cells[3])) continue;
    steps.push({
      order: Number(cells[0]), scId: cells[1], checkpoint: cells[2], blocking: cells[3].toLowerCase() === 'oui',
      verifBO: boIdx >= 0 && YES_BO.test(cells[boIdx] || ''),
    });
  }
  return steps;
}

function splitRow(line) {
  const cells = line.split('|').map((c) => c.trim());
  // Une ligne markdown "| a | b |" produit des cellules vides en tête/queue (avant le premier
  // et après le dernier "|") — les retirer sans toucher aux vraies cellules vides internes.
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** Parseur générique de table markdown (colonnes variables) → tableau d'objets {enTête: valeur}. */
function parseGenericTable(lines) {
  const rows = lines.filter((l) => l.trim().startsWith('|')).map(splitRow);
  if (rows.length < 2) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => !isSeparatorRow(r)).map((cells) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
    return obj;
  });
}


/**
 * Extrait la table "### Cas de bord" d'un parcours (si présente) → tableau de
 * { scId, description, sessionIsolee, verifBO, ordreRecommande }.
 * Tolère les variations de colonnes entre parcours : le nom de colonne prime sur la position.
 */
function parseEdgeCases(pLines) {
  const startIdx = pLines.findIndex((l) => l.trim() === '### Cas de bord');
  if (startIdx === -1) return [];
  const rest = pLines.slice(startIdx + 1);
  const stopIdx = rest.findIndex((l) => l.startsWith('### ') || l.startsWith('## ') || l.startsWith('---'));
  const lines = stopIdx === -1 ? rest : rest.slice(0, stopIdx);

  return parseGenericTable(lines)
    .map((row) => {
      const scId = row['SC'] || Object.values(row).find((v) => new RegExp(`^${SC_ID}$`, 'i').test(v));
      if (!scId) return null;
      return {
        scId,
        description: row['Description courte'] || '',
        sessionIsolee: YES.test(row['Session isolée'] || ''),
        verifBO: YES_BO.test(row['Vérif BO ?'] || row['Vérif BO'] || ''),
        ordreRecommande: row['Ordre recommandé'] || '',
      };
    })
    .filter(Boolean);
}

/** Fichier de parcours d'un scope. */
export function parcoursFileFor(scope = 'front') {
  return `config/${scope}/parcours.md`;
}

/**
 * Retourne { priority, category, happyPaths: [{ name, session, steps }], edgeCases: [...] }
 * pour le parcours `parcoursId` (ex. "P-003"), ou lève si introuvable dans `filePath`.
 */
export function parseParcours(parcoursId, filePath = 'config/front/parcours.md') {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const pLines = section(lines, `## [${parcoursId}]`, ['## [', '## Bilan']);
  if (!pLines) throw new Error(`[parcours] "${parcoursId}" introuvable dans ${filePath}`);

  const priority = (pLines.find((l) => l.startsWith('**Priorité**')) || '').split(':')[1]?.trim() || null;
  const category = (pLines.find((l) => l.startsWith('**Catégorie**')) || '').split(':')[1]?.trim() || null;

  const happyPaths = [];
  for (let i = 0; i < pLines.length; i++) {
    const line = pLines[i];
    if (!line.startsWith('### Happy path')) continue;
    const name = line.replace(/^###\s*Happy path\s*—\s*/, '').trim();
    const rest = pLines.slice(i + 1);
    const stopIdx = rest.findIndex((l) => l.startsWith('### ') || l.startsWith('---'));
    const hpLines = stopIdx === -1 ? rest : rest.slice(0, stopIdx);
    const sessionLine = hpLines.find((l) => l.trim().startsWith('**Session**'));
    const session = sessionLine ? sessionLine.split(':').slice(1).join(':').trim() : null;
    const steps = parseHappyPathTable(hpLines).sort((a, b) => a.order - b.order);
    happyPaths.push({ name, session, steps });
  }

  const edgeCases = parseEdgeCases(pLines);

  return { priority, category, happyPaths, edgeCases };
}

/** Comme parseParcours, sur le fichier `config/<scope>/parcours.md`. Lève si le parcours est absent. */
export function parseParcoursForScope(parcoursId, scope = 'front') {
  return parseParcours(parcoursId, parcoursFileFor(scope));
}
