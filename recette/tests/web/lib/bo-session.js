/**
 * Accès au back-office depuis un scénario Front (scénarios « croisés »).
 *
 * Un `hub` est créé UNE fois par exécution du runner. Il ouvre la session back-office PARESSEUSEMENT, au premier
 * `bo.open()` d'un scénario : un contexte navigateur SÉPARÉ de celui du Front (jamais de cookies partagés),
 * connexion une seule fois par exécution, session réutilisée par les scénarios suivants (et pendant tout un
 * parcours), fermée en fin d'exécution (`hub.close()`). Un échec de connexion est mis en cache : pas de
 * seconde tentative (évite de verrouiller le compte de test).
 *
 * Garde-fous (config/backoffice/guardrails.md) :
 *  - niveau par défaut = LECTURE ;
 *  - une écriture exige `meta.boAccess: 'ecriture-limitee'` dans la spec ET `**Écriture limitée autorisée** : oui`
 *    dans guardrails.md — sinon le scénario est ⏭ SAUTÉ avec la raison (refus explicite) ;
 *  - en niveau LECTURE, toute requête POST/PUT/PATCH/DELETE émise par le back-office est ABORTÉE (la connexion,
 *    faite avant, n'est pas concernée) et le scénario est marqué ❌ ; limite connue : une recherche ou un
 *    filtre implémenté en POST sera aussi bloqué — à déclarer alors dans guardrails.md, ligne
 *    `**POST de lecture autorisés** : /chemin/a, /chemin/b/*` (chemins exacts ou jokers `*` = un segment,
 *    `**` = plusieurs ; jamais de regex), plutôt que de passer en `ecriture-limitee` ;
 *  - le même filtre protège un run `--scope=backoffice` (createBoScopeGuard) ; seul le NIVEAU est géré, le nettoyage
 *    d'une écriture limitée n'est PAS fait par le runner (c'est à la spec de supprimer ce qu'elle crée) ;
 *  - `bo.assertWriteAllowed('libellé')` : à appeler dans la spec juste avant une action d'écriture (clic
 *    « Enregistrer », « Supprimer »...) ; lève BoGuardrailError en niveau LECTURE ;
 *  - jamais de capture d'écran du back-office (voir session.js).
 *
 * API passée aux specs (`run({ ..., bo })`) :
 *   bo.enabled   — le BO est disponible pour ce scénario (false hors scénario croisé ou si le parcours ne le demande pas)
 *   bo.access    — 'lecture' | 'ecriture-limitee' (niveau effectif de ce scénario)
 *   await bo.open() → session back-office { page, selectors, goto, gotoHome, expectSelector, ... }
 *   bo.assertWriteAllowed(action)
 */
import { readFileSync, existsSync } from 'node:fs';
import { openWebSession } from './session.js';
import { boAvailability } from '../../shared/load-test-config.js';
import { BoSkipError, BoGuardrailError, BoConnectionError } from '../../shared/bo-errors.js';
import { SelectorNotFoundError } from '../../shared/failure-context.js';
import { sanitizeErrorMessage } from '../../shared/safe-error.js';

const GUARDRAILS_PATH = 'config/backoffice/guardrails.md';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Lit guardrails.md → { found, allowWrite, readPosts }. Absent ou illisible = écriture non autorisée.
 * `readPosts` : motifs de chemins des POST de simple LECTURE (ex. chargement des lignes d'une liste), permis même
 * en niveau LECTURE. Ligne dédiée, en début de ligne : `**POST de lecture autorisés** : /chemin/a, /chemin/b/*`.
 */
export function loadGuardrails() {
  if (!existsSync(GUARDRAILS_PATH)) return { found: false, allowWrite: false, readPosts: [] };
  const content = readFileSync(GUARDRAILS_PATH, 'utf8');
  const m = content.match(/\*\*Écriture limitée autorisée\*\*\s*:\s*(\S+)/i);
  const p = content.match(/^[ \t]*\*\*POST de lecture autoris[ée]s\*\*[ \t]*:[ \t]*(.*)$/im);
  const readPosts = p ? p[1].split(',').map((x) => x.trim().replace(/^`|`$/g, '')).filter((x) => x.startsWith('/')) : [];
  return { found: true, allowWrite: !!m && /^oui/i.test(m[1]), readPosts };
}

/**
 * Un chemin d'URL correspond-il à un motif de la liste blanche ? Chemin exact, ou jokers simples (jamais de regex
 * libre) : `*` = un segment (`/api/*\/rows`), `**` = un ou plusieurs segments (`/api/**`). Casse respectée, query
 * ignorée, slash final ignoré.
 */
export function pathMatches(pattern, pathname) {
  const strip = (x) => (x.length > 1 ? x.replace(/\/+$/, '') : x);
  const re = strip(pattern).split(/(\*\*|\*)/).map((t) => (t === '**' ? '.+' : t === '*' ? '[^/]+' : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
  return new RegExp(`^${re}$`).test(strip(pathname));
}

/**
 * Filtre de requêtes réutilisable (handler `route`) : tant que `getLevel()` vaut 'lecture', abandonne
 * POST/PUT/PATCH/DELETE, sauf les POST de simple lecture listés dans guardrails.md (`guardrails.readPosts`).
 * `onViolation()` est appelé pour chaque requête bloquée (le runner marque alors le scénario ❌ ; le message
 * affiché suggère la ligne « POST de lecture autorisés » de guardrails.md, voir tests/shared/runner.js).
 */
export function makeWriteGuard(guardrails, getLevel, onViolation) {
  return (route) => {
    const req = route.request();
    if (getLevel() === 'lecture' && WRITE_METHODS.has(req.method())) {
      let pathname = '';
      try { pathname = new URL(req.url()).pathname; } catch { /* URL illisible : traitée comme écriture */ }
      const isReadPost = req.method() === 'POST' && guardrails.readPosts.some((p) => pathMatches(p, pathname));
      if (!isReadPost) {
        onViolation();
        return route.abort('blockedbyclient');
      }
    }
    return route.continue();
  };
}

/**
 * Pose le filtre sur la session et le retire à sa fermeture. Contexte privé : filtre sur le contexte (couvre aussi
 * les popups). Fenêtre partagée (RECETTE_USE_WINDOW, `session.sharedWindow`) : filtre sur l'ONGLET du run
 * seulement, pour ne rien filtrer ailleurs dans la fenêtre de l'utilisateur, et retiré en fin de run.
 */
export async function installWriteGuard(session, guard) {
  const target = session.sharedWindow ? session.page : session.context;
  const closeSession = session.close;
  await target.route('**/*', guard);
  session.close = async () => { await target.unroute('**/*', guard).catch(() => {}); await closeSession(); };
}

/**
 * Garde-fou du scope `backoffice` (run `--scope=backoffice`, session ouverte directement sans passer par
 * createBoHub) : même filtre que pour les scénarios Front croisés. À appeler APRÈS l'ouverture de session (la
 * connexion, un POST légitime, est déjà faite). Niveau par scénario : LECTURE par défaut ; `meta.boAccess:
 * 'ecriture-limitee'` n'est autorisé que si guardrails.md l'autorise (sinon scénario ⏭ SAUTÉ, refus explicite).
 * ATTENTION : seul le NIVEAU est géré ici. Le nettoyage (supprimer ce que le scénario a créé) n'est PAS fait par le
 * runner : il incombe à la spec et aux consignes de guardrails.md.
 */
export async function createBoScopeGuard(session) {
  const guardrails = loadGuardrails();
  let level = 'lecture';
  let violations = 0;
  await installWriteGuard(session, makeWriteGuard(guardrails, () => level, () => { violations += 1; }));
  return {
    forScenario(meta) {
      const wanted = requestedLevel(meta);
      const refusal = wanted === 'ecriture-limitee' && !guardrails.allowWrite
        ? `Garde-fou : écriture back-office refusée (${GUARDRAILS_PATH} n'autorise pas ÉCRITURE-LIMITÉE — ligne « Écriture limitée autorisée : oui » absente)`
        : null;
      level = refusal ? 'lecture' : wanted;
      const lvl = level;
      return {
        enabled: false, // pas de back-office « croisé » dans ce scope : la session du run EST le back-office
        access: lvl,
        refusal,
        takeViolations() { const n = violations; violations = 0; return n; },
        assertWriteAllowed(action = 'écriture') {
          if (lvl !== 'ecriture-limitee') {
            throw new BoGuardrailError(`Écriture back-office refusée (« ${action} ») : niveau LECTURE — déclarer meta.boAccess: 'ecriture-limitee' et l'autoriser dans ${GUARDRAILS_PATH}`);
          }
        },
      };
    },
  };
}

/** Niveau demandé par la spec : `meta.boAccess` ('lecture' par défaut, 'ecriture-limitee'). */
function requestedLevel(meta) {
  return /^ecriture/i.test(String(meta?.boAccess ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')) ? 'ecriture-limitee' : 'lecture';
}

export function createBoHub({ headless = true } = {}) {
  const guardrails = loadGuardrails();
  let sessionPromise = null;
  let currentLevel = 'lecture';
  let violations = 0;
  
  async function openSession() {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const session = await openWebSession({ headless, scope: 'backoffice' });
        // Garde-fou LECTURE : posé APRÈS la connexion (qui est un POST légitime).
        await installWriteGuard(session, makeWriteGuard(guardrails, () => currentLevel, () => { violations += 1; }));
        return session;
      })().catch((err) => {
        if (err instanceof SelectorNotFoundError) throw err; // heal du fichier backoffice
        // Message Playwright nettoyé (1re ligne, URLs masquées) : jamais l'erreur brute.
        throw new BoConnectionError(`Connexion back-office impossible : ${sanitizeErrorMessage(err.message).replace(/^Connexion impossible : /, '')}`);
      });
    }
    return sessionPromise;
  }

  return {
    /** Objet `bo` d'UN scénario. `enabled: false` = BO non demandé (open() lève BoSkipError). */
    forScenario(meta, { enabled = true } = {}) {
      const wants = !!meta?.needsBackoffice;
      const level = requestedLevel(meta);
      let refusal = null;
      if (wants) {
        const avail = boAvailability();
        if (!avail.ok) refusal = `Back-office indisponible : ${avail.reason}`;
        else if (level === 'ecriture-limitee' && !guardrails.allowWrite) {
          refusal = `Garde-fou : écriture back-office refusée (${GUARDRAILS_PATH} n'autorise pas ÉCRITURE-LIMITÉE — ligne « Écriture limitée autorisée : oui » absente)`;
        }
      }
      const on = wants && enabled;
      let usedHere = false;
      return {
        enabled: on,
        access: level,
        refusal,
        get used() { return usedHere; },
        async open() {
          if (!on) throw new BoSkipError(wants ? 'Vérif BO non demandée par le parcours (colonne « Vérif BO ? » ≠ oui)' : 'Scénario non déclaré needsBackoffice');
          currentLevel = level;
          const s = await openSession();
          currentLevel = level;
          usedHere = true;
          return s;
        },
        assertWriteAllowed(action = 'écriture') {
          if (level !== 'ecriture-limitee') {
            throw new BoGuardrailError(`Écriture back-office refusée (« ${action} ») : niveau LECTURE — déclarer meta.boAccess: 'ecriture-limitee' et l'autoriser dans ${GUARDRAILS_PATH}`);
          }
        },
        /** Nombre de requêtes d'écriture bloquées depuis le dernier appel (remis à zéro). */
        takeViolations() { const n = violations; violations = 0; return n; },
      };
    },
    get opened() { return !!sessionPromise; },
    async close() {
      if (!sessionPromise) return;
      const p = sessionPromise;
      sessionPromise = null;
      try { await (await p).close(); } catch { /* connexion jamais établie ou déjà fermée */ }
    },
  };
}
