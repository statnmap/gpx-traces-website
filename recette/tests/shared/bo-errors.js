/**
 * Erreurs propres aux scénarios croisés Front + back-office (voir tests/web/lib/bo-session.js).
 * Le harnais (tests/shared/runner.js) les traite à part d'un échec d'assertion métier :
 *  - BoSkipError      → scénario ⏭ SAUTÉ (BO non configuré, non demandé, garde-fou qui refuse) — pas une erreur ;
 *  - BoGuardrailError → scénario ❌ : le scénario a tenté une écriture que son niveau d'accès n'autorise pas ;
 *  - BoConnectionError→ scénario ❌ avec un message nettoyé (jamais de dump brut, jamais de capture d'écran).
 */
export class BoSkipError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'BoSkipError';
  }
}

export class BoGuardrailError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BoGuardrailError';
  }
}

export class BoConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BoConnectionError';
  }
}
