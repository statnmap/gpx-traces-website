/**
 * Point d'entrée unique pour charger config/{front,backoffice}/secrets.md et config/{front,backoffice}/site.md depuis tests/**.
 * Règle d'architecture : aucun fichier sous tests/ ne doit importer src/load-config.js
 * ni référencer config/{front,backoffice}/secrets.md / config/{front,backoffice}/site.md directement — uniquement via ce module.
 * (Voir garde-fou pre-commit qui bloque tout import direct détecté sous tests/.)
 */
export {
  isCI,
  reportUrl,
  loadSiteConfig,
  loadSecrets,
  loadHttpCredentials,
  loadBoConfig,
  loadBoSecrets,
  boAvailability,
} from '../../src/load-config.js';
