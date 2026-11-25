#!/usr/bin/env node
/**
 * Point d'entrée CLI du runner déterministe (zéro IA tant que rien ne casse).
 * Un dossier de recette = un projet (un Front + un back-office reliés).
 * Usage : node runner/run-recette.mjs [--scope=<front|backoffice>] [--parcours=P-xxx[,P-yyy,...]] [--resume]
 *         node runner/run-recette.mjs [--scope=<front|backoffice>] --list   (lecture seule)
 *         node runner/run-recette.mjs [--scope=<front|backoffice>] --ephemeres   (specs éphémères SC-RT-NNN / BO-RT-NNN seules)
 * Scope par défaut : front. Scénarios `SC-…` = front, `BO-…` = backoffice (préfixe de l'id dans meta.id).
 *
 * Scénarios croisés : une spec Front qui déclare `meta.needsBackoffice: true` reçoit `bo`, accès au back-office
 * ouvert paresseusement dans un contexte séparé (voir tests/web/lib/bo-session.js et le README du dossier).
 * En mode parcours, le back-office n'est disponible que pour les SC dont la colonne `Vérif BO ?` vaut `oui`.
 *
 * Sur un sélecteur cassé (SelectorNotFoundError) : écrit le contexte de heal
 * (outputs/heal/*.json) et l'état d'avancement (outputs/heal/.state_*.json), puis sort
 * avec le code 2. Claude (commande /recette-parcours) lit le contexte, répare le fichier de sélecteurs
 * concerné, puis relance cette même commande avec --resume pour reprendre exactement où
 * ça s'est arrêté. Plafond : 2 tentatives de heal par sélecteur, puis diagnostic manuel.
 *
 * `--ephemeres` : état et résultats PROPRES (suffixe `_ephemeres` : outputs/heal/.state_<scope>_ephemeres.json,
 * .last-results_<scope>_ephemeres.json), pour ne jamais écraser l'état d'un run normal non terminé ; `--resume` reprend
 * alors l'état éphémère. Le verrou reste par scope (jamais deux runs simultanés sur un scope). Incompatible avec --parcours.
 *
 * Codes de sortie : 0 = terminé (y compris « déjà terminé » après un --resume), 1 = erreur (message nettoyé, jamais de dump
 * brut), 2 = heal requis, 3 = un autre runner est déjà en cours pour ce scope, 4 = RIEN TROUVÉ à exécuter (scope sans
 * spec, --parcours inconnu, parcours sans SC exploitable) : jamais un faux vert, le message liste ce qui est disponible.
 * `--list` reste à 0 même sans rien (il affiche « 0 SC »).
 * Un sélecteur cassé côté back-office (scénario croisé) suit le même chemin : code 2, heal de config/backoffice/selectors.md.
 */
import { readdir, readFile, writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, openSync, writeSync, closeSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { createRunner } from '../tests/shared/runner.js';
import { resetAllAttempts, recordSelectorFailure, SelectorNotFoundError } from '../tests/shared/failure-context.js';
import { sanitizeErrorMessage } from '../tests/shared/safe-error.js';
import { openWebSession } from '../tests/web/lib/session.js';
import { writeReport } from '../tests/web/lib/report.js';
import { resolveSelectorsPath } from '../tests/web/lib/selectors.js';
import { parseParcoursForScope, parcoursFileFor } from '../tests/web/lib/parcours.js';
import { createBoHub, createBoScopeGuard } from '../tests/web/lib/bo-session.js';

// Les specs des deux scopes vivent dans tests/web/scenarios/ ; le préfixe de meta.id les distingue.
const SCOPES = {
  front: (id) => !id?.startsWith('BO-'),
  backoffice: (id) => id?.startsWith('BO-'),
};
const SPECS_DIR = 'tests/web/scenarios';

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (arg.startsWith('--')) args[arg.slice(2)] = true;
  }
  return args;
}

function statePath(scope) {
  return `outputs/heal/.state_${scope}.json`;
}

async function loadState(scope) {
  try {
    return JSON.parse(await readFile(statePath(scope), 'utf8'));
  } catch {
    return { results: [], done: [] };
  }
}

async function saveState(scope, state) {
  await mkdir('outputs/heal', { recursive: true });
  await writeFile(statePath(scope), JSON.stringify(state, null, 2), 'utf8');
}

async function clearState(scope) {
  await rm(statePath(scope), { force: true });
}

// Les fichiers `*.example.*` sont des modèles (voir tests/web/scenarios/README.md) : jamais exécutés.
// Specs éphémères d'une recette de ticket (`SC-RT-NNN` / `BO-RT-NNN`, gitignorées) : exclues de tout run normal, et seules
// chargées avec `--ephemeres`. Elles ne polluent donc jamais la recette permanente.
const EPHEMERE_ID = /^(SC|BO)-RT-\d+/;
async function loadSpecsFrom(dir, filterId, ephemeres = !!args.ephemeres) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.spec.js') && !f.includes('.example.')).sort();
  const specs = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    if (EPHEMERE_ID.test(mod.meta?.id ?? '') !== ephemeres) continue;
    if (!filterId || filterId(mod.meta?.id)) specs.push(mod);
  }
  return specs;
}

/** Identifiants P-xxx déclarés dans config/<scope>/parcours.md (liste vide si le fichier est absent). */
function knownParcoursIds(scope) {
  const file = parcoursFileFor(scope);
  if (!existsSync(file)) return [];
  return [...new Set([...readFileSync(file, 'utf8').matchAll(/^## \[(P-[\w-]+)\]/gm)].map((m) => m[1]))];
}

/** Message « rien trouvé » (code 4) : dit ce qui manque et ce qui est disponible, sans jamais afficher de contenu de page. */
function nothingFound(reason, hints = []) {
  console.error(`\n⚠ Rien à exécuter : ${reason}`);
  for (const h of hints) console.error(`   ${h}`);
  console.error('   Code de sortie 4 : ce n\'est PAS un succès (voir `--list` pour la couverture).');
  return { exitCode: 4 };
}

function resumeCommand(scope, parcoursIds) {
  return `node runner/run-recette.mjs --scope=${scope}${parcoursIds ? ` --parcours=${parcoursIds.join(',')}` : ''}${args.ephemeres ? ' --ephemeres' : ''} --resume`;
}

function printHealHint({ label, healContextPath, healExceeded, scope, healScope = scope, parcoursIds }) {
  if (healExceeded) {
    console.error(`\n⛔ Plafond de tentatives de heal dépassé pour ${label} — changement probablement fonctionnel, pas une dérive de sélecteur.`);
    console.error('   Diagnostic complet requis en mode manuel sur ce scénario.');
    return;
  }
  console.error(`\n✋ Sélecteur cassé sur ${label}. Contexte de heal : ${healContextPath}`);
  console.error(`   Réparer ${resolveSelectorsPath(healScope)} puis relancer :`);
  console.error(`   ${resumeCommand(scope, parcoursIds)}`);
}

/**
 * Ouvre la session en englobant TOUTES les erreurs d'ouverture : une SelectorNotFoundError (ex. formulaire de
 * connexion modifié) suit le chemin du heal comme n'importe quel échec de sélecteur ; toute autre erreur est
 * réduite à un message nettoyé. Sans ce filet, l'exception remonterait au top-level Node, qui afficherait
 * TOUTES les propriétés de l'erreur (domSnippet, interactiveTexts...) en clair — potentiellement des données réelles.
 */
async function openSessionSafely({ scope, parcoursIds, openSession }) {
  try {
    return { session: await openSession() };
  } catch (err) {
    if (err instanceof SelectorNotFoundError) {
      const healScope = err.selectorScope || scope;
      const { contextPath, exceeded } = recordSelectorFailure({
        scope: healScope, scenario: 'ouverture-session', step: 0,
        selectorKey: err.selectorKey, selectorTried: err.selectorTried, selectorSource: err.selectorSource,
        url: err.url, domSnippet: err.domSnippet, interactiveTexts: err.interactiveTexts,
        screenshotPath: err.screenshotPath, errorMessage: err.message,
      });
      printHealHint({ label: 'l\'ouverture de session', healContextPath: contextPath, healExceeded: exceeded, scope, healScope, parcoursIds });
      return { exitCode: 2 };
    }
    console.error(`\n✗ Ouverture de session impossible : ${sanitizeErrorMessage(err.message)}`);
    return { exitCode: 1 };
  }
}

/**
 * Écrit le rapport final + l'export brut des résultats (`.last-results_*.json`, relu par la commande
 * /recette-parcours et par --list), puis purge l'état de reprise et les compteurs de heal.
 */
async function finish({ scope, stateScope, session, runner, parcoursIds, resultsFileSuffix, boUsed, ephemeres = false }) {
  const reportPath = await writeReport({ scope, url: session.baseUrl, results: runner.results, parcoursId: parcoursIds?.join('+'), ephemeres });
  await mkdir('outputs/heal', { recursive: true });
  await writeFile(
    `outputs/heal/.last-results_${scope}${resultsFileSuffix}.json`,
    JSON.stringify({ url: session.baseUrl, results: runner.results, ...(parcoursIds ? { parcoursIds } : {}) }, null, 2),
    'utf8',
  );
  await clearState(stateScope);
  // Un run éphémère ne touche pas aux compteurs de heal d'un run normal éventuellement en cours.
  if (!ephemeres) {
    resetAllAttempts(scope);
    if (boUsed) resetAllAttempts('backoffice');
  }
  return reportPath;
}

/**
 * Mode scénarios individuels : charge les specs restantes du scope, ouvre une session, exécute dans l'ordre,
 * persiste l'état après chaque scénario (reprise possible même en cas de crash brutal), s'arrête proprement
 * sur un sélecteur cassé, écrit le rapport final une fois tout terminé.
 */
async function runScope({ scope, resume }) {
  const ephemeres = !!args.ephemeres;
  // État et résultats propres à un run éphémère : jamais d'écrasement de l'état d'un run normal.
  const stateScope = ephemeres ? `${scope}_ephemeres` : scope;
  const specs = await loadSpecsFrom(path.resolve(SPECS_DIR), SCOPES[scope]);
  if (specs.length === 0) {
    const prefix = scope === 'backoffice' ? 'BO-' : 'SC-';
    if (ephemeres) {
      return nothingFound(`aucune spec éphémère ${prefix}RT-NNN pour le scope "${scope}" dans ${SPECS_DIR}/ (les *.example.* sont ignorés).`, [
        'Les specs éphémères (SC-RT-NNN) sont gitignorées : les écrire d\'abord.',
      ]);
    }
    return nothingFound(`aucune spec ${prefix}… pour le scope "${scope}" dans ${SPECS_DIR}/ (les *.example.* sont ignorés).`, [
      `Transcrire un scénario (${SPECS_DIR}/README.md) ou lancer \`--list\` pour la couverture.`,
      `Parcours connus pour ce scope : ${knownParcoursIds(scope).join(', ') || 'aucun'}.`,
    ]);
  }
  const state = resume ? await loadState(stateScope) : { results: [], done: [] };
  const todo = specs.filter((s) => !state.done.includes(s.meta.id));

  if (todo.length === 0) {
    console.log(`Déjà terminé : les ${specs.length} scénario(s) du scope "${scope}" sont déjà joués dans l'état de reprise (relancer sans --resume pour rejouer).`);
    return { exitCode: 0 };
  }

  const opened = await openSessionSafely({ scope, openSession: () => openWebSession({ headless: true, scope }) });
  if (!opened.session) return { exitCode: opened.exitCode };
  const { session } = opened;

  const runner = createRunner();
  runner.results.push(...state.results);

  // Back-office des scénarios croisés : uniquement pour un run Front (le scope backoffice a sa propre session).
  const boHub = scope === 'front' ? createBoHub({ headless: true }) : null;
  // Scope backoffice : même garde-fou d'écriture (LECTURE par défaut, ÉCRITURE-LIMITÉE seulement si guardrails.md le permet).
  const boGuard = scope === 'backoffice' ? await createBoScopeGuard(session) : null;
  let boUsed = false;

  try {
    for (const spec of todo) {
      const bo = boHub?.forScenario(spec.meta, { enabled: true }) ?? boGuard?.forScenario(spec.meta);
      const { result, halt, healContextPath, healExceeded, healScope } = await runner.runScenario(
        spec.meta,
        spec.run,
        { session, selectors: session.selectors, bo },
      );
      boUsed ||= !!bo?.used;

      if (halt) {
        // Ne pas persister cette tentative avortée dans state.results/done : seul le contexte
        // de heal et le compteur de tentatives (déjà écrits par recordSelectorFailure) doivent
        // en garder trace. Sinon, une fois la reprise réussie, le rapport final affiche à la
        // fois l'échec avorté et le succès pour le même scénario.
        await saveState(stateScope, state);
        printHealHint({ label: result.id, healContextPath, healExceeded, scope, healScope });
        return { exitCode: 2 };
      }

      state.done.push(result.id);
      state.results = runner.results;
      await saveState(stateScope, state);
    }
  } finally {
    await boHub?.close();
    await session.close();
  }

  const reportPath = await finish({ scope, stateScope, session, runner, resultsFileSuffix: ephemeres ? '_ephemeres' : '', boUsed, ephemeres });
  console.log(`\n✅ Recette terminée. Rapport : ${reportPath}`);
  return { exitCode: 0 };
}

/**
 * Construit la liste ordonnée de steps (happy paths + cas de bord) d'UN parcours, chaque step
 * tagué `parcoursId` pour pouvoir fusionner plusieurs parcours dans une seule exécution/rapport
 * (voir runParcours) sans perdre de quel parcours il provient.
 */
function buildParcoursSteps(parcoursId, scope) {
  const parcours = parseParcoursForScope(parcoursId, scope);
  const steps = [];

  for (const hp of parcours.happyPaths) {
    // Un happy path peut lui-même se déclarer "isolée" (ex. « Session : isolée (test sans connexion) ») —
    // sans quoi ses steps hériteraient à tort de la session continue partagée par le reste du parcours, et un
    // test conçu pour vérifier l'absence de session verrait les cookies laissés par les scénarios précédents.
    const hpIsolated = /isolée/i.test(hp.session || '');
    for (const step of hp.steps) {
      steps.push({ ...step, parcoursId, happyPath: hp.name, key: `${parcoursId}::${hp.name}::${step.scId}`, isolated: hpIsolated });
    }
  }

  // Cas de bord : insérés selon leur "Ordre recommandé" ("avant SC-XXX" / "après SC-XXX")
  // s'il référence un step déjà présent DANS CE MÊME parcours, sinon ajoutés en fin de celui-ci.
  for (const ec of parcours.edgeCases) {
    const ecStep = {
      scId: ec.scId, parcoursId, checkpoint: ec.description, happyPath: 'Cas de bord',
      key: `${parcoursId}::CasDeBord::${ec.scId}`, blocking: false,
      isolated: ec.sessionIsolee, verifBO: ec.verifBO,
    };
    const beforeMatch = /avant\s+((?:SC|BO)-[\w-]+)/i.exec(ec.ordreRecommande);
    const afterMatch = /après\s+((?:SC|BO)-[\w-]+)/i.exec(ec.ordreRecommande);
    let inserted = false;
    if (beforeMatch) {
      const idx = steps.findIndex((s) => s.scId === beforeMatch[1]);
      if (idx !== -1) { steps.splice(idx, 0, ecStep); inserted = true; }
    } else if (afterMatch) {
      const idx = steps.findIndex((s) => s.scId === afterMatch[1]);
      if (idx !== -1) { steps.splice(idx + 1, 0, ecStep); inserted = true; }
    }
    if (!inserted) steps.push(ecStep);
  }

  return steps;
}

/**
 * Mode parcours (config/<scope>/parcours.md) : une session unique pour toute la séquence, ordre défini
 * par le document (pas l'ordre alphabétique des fichiers), sémantique "Bloquant ?" respectée
 * (un échec bloquant marque le reste du même happy path ⛔ BLOQUÉ sans l'exécuter, mais n'arrête
 * pas le happy path suivant). Un même SC peut apparaître dans plusieurs happy paths d'un même
 * parcours — la clé de suivi de reprise est donc (parcours, happy path, SC), pas le SC seul.
 *
 * `parcoursIds` accepte plusieurs parcours en une seule exécution (ex. --parcours=P-001,P-003) :
 * une seule session continue (hors steps isolés) et **un seul rapport final**, plutôt qu'un
 * rapport par parcours — c'est la manière de lancer "la recette complète" en un coup.
 */
async function runParcours({ scope, parcoursIds, resume }) {
  const allSpecs = await loadSpecsFrom(path.resolve(SPECS_DIR), undefined, false);
  const specById = Object.fromEntries(allSpecs.map((s) => [s.meta.id, s]));

  const known = knownParcoursIds(scope);
  const unknown = parcoursIds.filter((id) => !known.includes(id));
  if (unknown.length) {
    return nothingFound(`parcours inconnu(s) pour le scope "${scope}" : ${unknown.join(', ')}.`, [
      `Parcours connus (${parcoursFileFor(scope)}) : ${known.join(', ') || 'aucun'}.`,
    ]);
  }
  const steps = parcoursIds.flatMap((id) => buildParcoursSteps(id, scope));
  if (steps.length === 0) {
    return nothingFound(`aucun happy path ni cas de bord exploitable (SC) dans : ${parcoursIds.join(', ')}.`, [
      'Vérifier les tableaux « Happy path » et « Cas de bord » du parcours (colonnes Ordre | SC | Checkpoint | Bloquant ?).',
    ]);
  }

  const stateScope = `${scope}_parcours_${parcoursIds.join('+')}`;
  const state = resume ? await loadState(stateScope) : { results: [], done: [], blockedHappyPaths: [] };
  const blockedHappyPaths = new Set(state.blockedHappyPaths || []);
  const todo = steps.filter((s) => !state.done.includes(s.key));

  if (todo.length === 0) {
    console.log(`Déjà terminé : parcours ${parcoursIds.join(', ')} déjà joué(s) dans l'état de reprise (relancer sans --resume pour rejouer).`);
    return { exitCode: 0 };
  }

  const opened = await openSessionSafely({ scope, parcoursIds, openSession: () => openWebSession({ headless: true, scope }) });
  if (!opened.session) return { exitCode: opened.exitCode };
  const { session } = opened;

  const runner = createRunner();
  runner.results.push(...state.results);

  // Back-office des scénarios croisés : ouvert au premier besoin, gardé ouvert pendant tout le parcours (Front
  // continu ET back-office : deux contextes séparés), fermé en fin d'exécution.
  const boHub = scope === 'front' ? createBoHub({ headless: true }) : null;
  const boGuard = scope === 'backoffice' ? await createBoScopeGuard(session) : null;
  let boUsed = false;

  // Clé de blocage "Bloquant ?" scopée par parcours : un HP bloquant dans P-001 ne doit pas
  // bloquer un HP de même nom (ex. "Cas de bord") dans P-003.
  const blockKey = (step) => `${step.parcoursId}::${step.happyPath}`;

  const recordSynthetic = async (step, status, observations) => {
    runner.results.push({
      id: step.scId, title: `${step.checkpoint} (${step.parcoursId} · ${step.happyPath})`, status,
      steps: [], observations, screenshot: null, durationMs: 0,
    });
    state.done.push(step.key);
    state.results = runner.results;
    await saveState(stateScope, state);
  };

  try {
    for (const step of todo) {
      if (blockedHappyPaths.has(blockKey(step))) {
        await recordSynthetic(step, 'BLOQUÉ', `Un checkpoint bloquant a échoué plus tôt dans le happy path "${step.happyPath}" (${step.parcoursId}).`);
        continue;
      }

      const spec = specById[step.scId];
      if (!spec) {
        await recordSynthetic(step, 'SKIP', `${step.scId} non transcrit en spec déterministe — à exécuter manuellement.`);
        continue;
      }

      // Step "Session isolée : oui" : contexte Playwright dédié (cloné de la session principale, sans nouvelle
      // connexion) pour ce step, sans perturber la session continue utilisée par le reste du parcours.
      let execSession = session;
      let isolatedSession = null;
      if (step.isolated) {
        isolatedSession = await session.cloneIsolated();
        execSession = isolatedSession;
      }

      const meta = { ...spec.meta, title: `${spec.meta.title} (${step.parcoursId} · ${step.happyPath})` };
      // Colonne « Vérif BO ? » = oui (ou facultatif) : le back-office est disponible pour ce SC (si la spec le déclare).
      const bo = boHub?.forScenario(spec.meta, { enabled: !!step.verifBO }) ?? boGuard?.forScenario(spec.meta);
      let outcome;
      try {
        outcome = await runner.runScenario(meta, spec.run, { session: execSession, selectors: execSession.selectors, bo });
      } finally {
        if (isolatedSession) await isolatedSession.close();
      }
      const { result, halt, healContextPath, healExceeded, healScope } = outcome;
      boUsed ||= !!bo?.used;

      // Vérif BO demandée par le parcours mais non automatisée (la spec ne déclare pas needsBackoffice) : annoter le
      // résultat pour que le rapport rappelle le point à vérifier à la main plutôt que de le taire.
      if (step.verifBO && !spec.meta.needsBackoffice) result.observations = `${result.observations || ''}\n[Vérif BO recommandée — lecture seule, non automatisée : la spec ne déclare pas needsBackoffice]`.trim();

      if (halt) {
        state.blockedHappyPaths = [...blockedHappyPaths];
        await saveState(stateScope, state);
        printHealHint({ label: `${result.id} (${step.parcoursId} · ${step.happyPath})`, healContextPath, healExceeded, scope, healScope, parcoursIds });
        return { exitCode: 2 };
      }

      state.done.push(step.key);
      state.results = runner.results;
      if (result.status === 'ÉCHOUÉ' && step.blocking) {
        blockedHappyPaths.add(blockKey(step));
        state.blockedHappyPaths = [...blockedHappyPaths];
      }
      await saveState(stateScope, state);
    }
  } finally {
    await boHub?.close();
    await session.close();
  }

  // Export brut, symétrique à celui du mode scénarios : permet à la commande /recette-parcours de relire les
  // résultats structurés par SC (sans reparser le markdown) pour savoir lesquels ont été couverts par ce
  // runner et lesquels restent à exécuter manuellement (SKIP, heal dépassé), puis fusionner le tout.
  const reportPath = await finish({ scope, stateScope, session, runner, parcoursIds, resultsFileSuffix: `_parcours_${parcoursIds.join('+')}`, boUsed });
  console.log(`\n✅ Parcours ${parcoursIds.join(', ')} terminé(s). Rapport : ${reportPath}`);
  return { exitCode: 0 };
}

/**
 * Mode lecture seule (--list) : pour chaque parcours de config/<scope>/parcours.md,
 * tableau SC | transcrit en spec ? | Vérif BO | dernier statut. Aucune session, aucun secret, aucun verrou.
 * Le dernier statut vient des outputs/heal/.last-results_<scope>*.json (le plus récent gagne par SC).
 */
async function listCouverture({ scope }) {
  const specs = await loadSpecsFrom(path.resolve(SPECS_DIR), undefined, false);
  const specIds = new Set(specs.map((s) => s.meta.id));
  const crossIds = new Set(specs.filter((s) => s.meta.needsBackoffice).map((s) => s.meta.id));

  const last = {};
  const healDir = 'outputs/heal';
  const resultFiles = (await readdir(healDir).catch(() => []))
    .filter((f) => f.startsWith(`.last-results_${scope}`) && f.endsWith('.json') && !f.includes('_ephemeres'))
    .map((f) => ({ f, mtime: statSync(path.join(healDir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
  for (const { f, mtime } of resultFiles) {
    const data = JSON.parse(await readFile(path.join(healDir, f), 'utf8'));
    const date = new Date(mtime).toISOString().slice(0, 10);
    for (const r of data.results || []) last[r.id] = { status: r.status, date };
  }

  const files = [parcoursFileFor(scope)].filter((f) => existsSync(f));
  const parcoursIds = knownParcoursIds(scope);
  if (parcoursIds.length === 0) {
    console.log(`Aucun parcours dans ${parcoursFileFor(scope)}${files.length ? '' : ' (fichier absent)'} : 0 SC.`);
  }

  let transcrit = 0;
  const seen = new Set();
  for (const pid of parcoursIds) {
    const steps = buildParcoursSteps(pid, scope);
    console.log(`\n## ${pid}\n\n| SC | Transcrit | Vérif BO | Dernier statut |\n|---|---|---|---|`);
    for (const s of steps) {
      const ok = specIds.has(s.scId);
      const l = last[s.scId];
      console.log(`| ${s.scId} (${s.happyPath}) | ${ok ? 'oui' : 'non'} | ${s.verifBO ? (crossIds.has(s.scId) ? 'oui (automatisée)' : 'oui (manuelle)') : '—'} | ${l ? `${l.status} (${l.date})` : 'jamais exécuté'} |`);
      if (!seen.has(s.scId)) { seen.add(s.scId); if (ok) transcrit++; }
    }
  }
  console.log(`\n${seen.size} SC distincts, ${transcrit} transcrits, ${seen.size - transcrit} sans spec (SKIP au run). Specs disponibles : ${specs.length} (scope ${scope} : ${specs.filter((x) => SCOPES[scope](x.meta.id)).length}).${seen.size === 0 ? ' 0 SC en parcours : un run avec --parcours= sortirait en code 4 (rien à exécuter).' : ''}`);
}

// Dernier filet : toute erreur non rattrapée est réduite à un message nettoyé (jamais l'objet brut).
function fail(err) {
  console.error(`\n✗ Erreur du runner : ${sanitizeErrorMessage(err?.message ?? err)}`);
  process.exit(1);
}
process.on('unhandledRejection', fail);
process.on('uncaughtException', fail);

// Garde-fous git : un clone neuf n'a pas core.hooksPath. On le réactive silencieusement (sans effet hors dépôt git).
function ensureGitHooks() {
  try {
    // Dossier imbriqué : les hooks vivent à la racine du dépôt (../.githooks), pas dans ce dossier.
    if (!existsSync('../.githooks')) return;
    const current = execFileSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (current === '.githooks') return;
  } catch {
    // clé absente (git config sort en erreur) ou git indisponible : on tente la configuration ci-dessous
  }
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
    console.log('ℹ Hooks git réactivés (core.hooksPath = .githooks).');
  } catch {
    // pas un dépôt git : rien à protéger
  }
}
ensureGitHooks();

const args = parseArgs(process.argv.slice(2));
const scope = args.scope || 'front';
if (!SCOPES[scope]) {
  console.error(`Scope "${scope}" inconnu (disponibles : ${Object.keys(SCOPES).join(', ')}).`);
  process.exit(1);
}
if (args.list) {
  try {
    await listCouverture({ scope });
  } catch (err) {
    fail(err);
  }
  process.exit(0);
}

// Verrou par scope (même clé que .state_*.json) : deux runners simultanés sur la même clé
// corrompraient l'état. Les scopes front et backoffice restent parallélisables. Un verrou dont le process
// n'existe plus (crash, kill) est repris automatiquement.
mkdirSync('outputs/heal', { recursive: true });
const lockFile = `outputs/heal/.lock_${scope}.json`;
function acquireLock() {
  try {
    const fd = openSync(lockFile, 'wx');
    writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    closeSync(fd);
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    return false;
  }
}
if (!acquireLock()) {
  let owner = {};
  try { owner = JSON.parse(readFileSync(lockFile, 'utf8')); } catch { /* verrou illisible : traité comme périmé */ }
  let alive = false;
  try { process.kill(owner.pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
  if (alive) {
    console.error(`Un runner est déjà en cours pour le scope ${scope} (pid ${owner.pid}, démarré ${owner.startedAt}). Attendre sa fin avant de relancer.`);
    process.exit(3);
  }
  rmSync(lockFile, { force: true });
  if (!acquireLock()) { console.error('Verrou repris par un autre runner entre-temps.'); process.exit(3); }
}
process.on('exit', () => rmSync(lockFile, { force: true }));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));

// Plusieurs parcours séparés par une virgule (--parcours=P-001,P-003) partagent une session continue et
// écrivent UN SEUL rapport final — c'est la façon de lancer "la recette complète" sans multiplier les rapports.
if (args.ephemeres && args.parcours !== undefined) {
  console.error('Options incompatibles : --ephemeres joue les specs SC-RT-NNN / BO-RT-NNN seules, sans parcours (retirer --parcours).');
  process.exit(1);
}
const parcoursIds = typeof args.parcours === 'string' ? args.parcours.split(',').map((p) => p.trim()).filter(Boolean) : [];
try {
  // `--parcours` fourni mais vide (ou sans valeur) : ne pas retomber silencieusement sur tous les scénarios.
  const { exitCode } = args.parcours !== undefined && !parcoursIds.length
    ? nothingFound('option --parcours sans identifiant (attendu : --parcours=P-001[,P-002]).', [`Parcours connus : ${knownParcoursIds(scope).join(', ') || 'aucun'}.`])
    : parcoursIds.length
    ? await runParcours({ scope, parcoursIds, resume: !!args.resume })
    : await runScope({ scope, resume: !!args.resume });
  process.exit(exitCode);
} catch (err) {
  fail(err);
}
