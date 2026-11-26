/**
 * Harnais d'exécution de scénario (pattern runScenario/addStep). Générique — utilisé pour
 * les scopes front et backoffice.
 * Distinction volontaire entre un ❌ d'assertion métier (on continue au scénario suivant,
 * le rapport le trace) et une SelectorNotFoundError (on arrête tout : le heal doit
 * réparer le sélecteur avant de reprendre — continuer produirait une cascade d'échecs).
 */
import { recordSelectorFailure, SelectorNotFoundError } from './failure-context.js';
import { sanitizeErrorMessage } from './safe-error.js';
import { BoSkipError } from './bo-errors.js';

export function createRunner() {
  const results = [];

  // `opts.bo: true` marque une étape de « Vérif BO » (le rapport les distingue des étapes Front).
  function addStep(result, ok, text, opts = {}) {
    result.steps.push({ ok, text, ...(opts.bo ? { bo: true } : {}) });
    if (!ok) result.status = 'ÉCHOUÉ';
  }

  /**
   * Exécute un scénario. `fn` reçoit { addStep, setObservations, ...ctx } (ctx : session, selectors, bo...).
   * Statut ⏭ SAUTÉ : scénario croisé dont le back-office est indisponible / non demandé / refusé par les garde-fous.
   * Retourne { result, halt } — halt=true signifie : arrêter la boucle CLI immédiatement
   * (sélecteur cassé, contexte de heal déjà écrit).
   */
  async function runScenario(meta, fn, ctx = {}) {
    const result = { ...meta, status: 'PASSÉ', steps: [], observations: '', screenshot: null, durationMs: 0 };
    const startedAt = Date.now();
    console.log(`▶ ${meta.id} — ${meta.title}`);
    const bo = ctx.bo;
    if (bo?.refusal) {
      // Refus connu avant tout (RECETTE_BO_* manquantes, garde-fou) : inutile de jouer la partie Front.
      result.status = 'SAUTÉ';
      result.observations = bo.refusal;
      results.push(result);
      console.log(`  ⏭ SAUTÉ — ${bo.refusal}`);
      return { result, halt: false };
    }
    try {
      await fn({
        ...ctx,
        addStep: (ok, text, opts) => addStep(result, ok, text, opts),
        setObservations: (text) => { result.observations = text; },
      });
      const blocked = bo?.takeViolations?.() ?? 0;
      if (blocked > 0) addStep(result, false, `Garde-fou LECTURE : ${blocked} requête(s) d'écriture vers le back-office bloquée(s). Si c'est un POST de simple lecture (liste, recherche), l'ajouter à la ligne « **POST de lecture autorisés** : /chemin/a, /chemin/b/* » de config/backoffice/guardrails.md`, { bo: true });
    } catch (err) {
      const blocked = bo?.takeViolations?.() ?? 0;
      if (blocked > 0) addStep(result, false, `Garde-fou LECTURE : ${blocked} requête(s) d'écriture vers le back-office bloquée(s). Si c'est un POST de simple lecture (liste, recherche), l'ajouter à la ligne « **POST de lecture autorisés** : /chemin/a, /chemin/b/* » de config/backoffice/guardrails.md`, { bo: true });
      if (err instanceof BoSkipError) {
        if (result.status === 'PASSÉ') result.status = 'SAUTÉ';
        result.observations = (result.observations ? result.observations + '\n' : '') + err.message;
        result.boCheck = !!bo?.used;
        result.durationMs = Date.now() - startedAt;
        results.push(result);
        console.log(`  ⏭ ${result.status} — ${err.message}`);
        return { result, halt: false };
      }
      if (err instanceof SelectorNotFoundError) {
        result.durationMs = Date.now() - startedAt;
        const healScope = err.selectorScope || 'front';
        const { contextPath, attempt, exceeded } = recordSelectorFailure({
          scope: healScope,
          scenario: meta.id,
          step: result.steps.length,
          selectorKey: err.selectorKey,
          selectorTried: err.selectorTried,
          selectorSource: err.selectorSource,
          url: err.url,
          domSnippet: err.domSnippet,
          interactiveTexts: err.interactiveTexts,
          screenshotPath: err.screenshotPath,
          errorMessage: err.message,
        });
        result.status = 'ÉCHOUÉ';
        result.observations = `Sélecteur cassé (${err.selectorKey}) — contexte de heal : ${contextPath} (tentative ${attempt})`;
        // Volontairement PAS de results.push(result) ici : cette tentative est avortée, pas un résultat
        // final (voir commentaire de l'appelant, runner/run-recette.mjs, "Ne pas persister cette
        // tentative avortée"). `results` est un tableau partagé par référence avec `state.results` côté
        // appelant (pas une copie) — un push ici fuiterait dans l'état persisté même sans réassignation
        // explicite, produisant un doublon dans le rapport final une fois la reprise (--resume) réussie.
        console.error(`  ✋ ${result.observations}`);
        return { result, halt: true, healContextPath: contextPath, healExceeded: exceeded, healScope };
      }
      // Message nettoyé (1re ligne, URLs masquées) : jamais l'erreur brute, qui peut embarquer des URL de session.
      const safe = sanitizeErrorMessage(err.message);
      result.status = 'ÉCHOUÉ';
      result.observations = (result.observations ? result.observations + '\n' : '') + `Exception: ${safe}`;
      console.error(`  ✗ ${safe}`);
    }
    result.durationMs = Date.now() - startedAt;
    if (bo?.used) { result.boCheck = true; result.boAccess = bo.access; }
    results.push(result);
    console.log(`  ${result.status === 'PASSÉ' ? '✅' : '❌'} ${result.status} (${(result.durationMs / 1000).toFixed(1)}s)`);
    return { result, halt: false };
  }

  return { results, runScenario };
}
