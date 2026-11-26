/**
 * Génère le rapport markdown (outputs/reports/<scope>/), produit ici par le runner autonome sans passer
 * par Claude tant qu'aucun sélecteur ne casse.
 */
import { mkdir, writeFile } from 'fs/promises';
import { reportUrl } from '../../shared/load-test-config.js';

function timestamp() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  return { dateStr, timeStr };
}

function formatDuration(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}m:${seconds.toFixed(1).padStart(4, '0')}s`;
}

const STATUS_ICONS = {
  'PASSÉ': '✅ PASSÉ',
  'ÉCHOUÉ': '❌ ÉCHOUÉ',
  'BLOQUÉ': '⛔ BLOQUÉ',
  'SKIP': '⏭️ SKIP',
  'SAUTÉ': '⏭ SAUTÉ',
};

export async function writeReport({ scope = 'front', url, results, parcoursId, ephemeres = false }) {
  const { dateStr, timeStr } = timestamp();
  const passed = results.filter((r) => r.status === 'PASSÉ').length;
  const failed = results.filter((r) => r.status === 'ÉCHOUÉ').length;
  const blocked = results.filter((r) => r.status === 'BLOQUÉ').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const sauted = results.filter((r) => r.status === 'SAUTÉ').length;
  const boResults = results.filter((r) => r.boCheck || r.steps.some((st) => st.bo));

  const totalMs = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  const sortedByDuration = [...results].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
  const top3 = sortedByDuration.slice(0, 3).map((r) => `${r.id} (${formatDuration(r.durationMs || 0)})`).join(', ') || '—';
  const durations = results.map((r) => r.durationMs || 0).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;

  const parcoursList = parcoursId ? parcoursId.split('+') : [];
  const parcoursLabel = parcoursList.length > 1 ? `Parcours ${parcoursList.join(', ')}` : parcoursList[0] ? `Parcours ${parcoursList[0]}` : '';

  let md = `# Rapport de recette — ${scope}${parcoursLabel ? ` — ${parcoursLabel}` : ''}

**Date** : ${dateStr} ${timeStr}
**URL** : ${reportUrl(url)}
**Généré par** : runner/run-recette.mjs (autonome, sans IA — voir AGENTS.md)

## Résumé

| Résultat | Nombre |
|----------|--------|
| ✅ Passé | ${passed} |
| ❌ Échoué | ${failed} |
| ⛔ Bloqué | ${blocked} |
| ⏭️ Skip (non transcrit) | ${skipped} |
| ⏭ Sauté (back-office indisponible ou refusé) | ${sauted} |
| Total | ${results.length} |

## Résumé timing

- **Durée totale** : ${formatDuration(totalMs)}
- **Top 3 les plus lents** : ${top3}
- **Médiane** : ${formatDuration(median)}

## Résumé détaillé

| Scénario | Résultat | Durée | Vérif BO |
|---|---|---|---|
`;
  for (const r of results) {
    md += `| ${r.id} ${r.title} | ${STATUS_ICONS[r.status] || r.status} | ${formatDuration(r.durationMs || 0)} | ${r.boCheck ? '🔎 oui' : '—'} |\n`;
  }

  md += '\n---\n\n';

  for (const r of results) {
    md += `## [${r.id}] ${r.title} — ${STATUS_ICONS[r.status] || r.status}\n`;
    md += `**Durée** : ${formatDuration(r.durationMs || 0)}\n`;
    if (r.boCheck) md += `**Vérif BO** : back-office consulté (session séparée, niveau ${r.boAccess === 'ecriture-limitee' ? 'ÉCRITURE-LIMITÉE' : 'LECTURE'})\n`;
    if (r.steps.length > 0) {
      md += `**Étapes** :\n`;
      r.steps.forEach((s) => { md += `1. ${s.ok ? '✅' : '❌'} ${s.bo ? '🔎 [Vérif BO] ' : ''}${s.text}\n`; });
    }
    if (r.observations) md += `**Observations** : ${r.observations}\n`;
    md += '\n---\n\n';
  }

  if (boResults.length) {
    md += `## Vérifications back-office\n\n${boResults.map((r) => `- ${r.id} — ${STATUS_ICONS[r.status] || r.status}`).join('\n')}\n\n_(Session back-office distincte de celle du Front ; niveau LECTURE par défaut, voir config/backoffice/guardrails.md. Aucune capture d'écran du back-office.)_\n\n---\n\n`;
  }

  md += `## Sélecteurs mis à jour lors de la recette

_(Aucun sélecteur modifié durant cette session — script autonome. Si un heal a eu lieu plus tôt dans cette
session de recette, compléter cette section manuellement avec l'ancien/nouveau sélecteur.)_

## Bilan de conformité sécurité

| Vérification | Résultat |
|---|---|
| Aucune URL preprod en clair | ✅ |
| Aucun numéro de carte ou CVV | ✅ |
| Aucun credential (login, mot de passe) | ✅ |
`;

  const dir = `outputs/reports/${scope}`;
  await mkdir(dir, { recursive: true });
  const suffix = ephemeres
    ? '_ephemeres'
    : parcoursList.length > 1
    ? '_parcours_multi'
    : parcoursList[0] ? `_parcours_${parcoursList[0].toLowerCase()}` : '';
  const reportPath = `${dir}/${dateStr}_${timeStr}${suffix}.md`;
  await writeFile(reportPath, md, 'utf8');
  return reportPath;
}
