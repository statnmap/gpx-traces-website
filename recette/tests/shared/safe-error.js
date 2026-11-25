/**
 * Message d'erreur "sûr" pour la sortie console, les rapports et l'état du runner : première ligne
 * seulement (le « Call log » de Playwright embarque l'URL complète visitée, paramètres de session
 * compris), toute URL remplacée par `<URL>`, longueur bornée. Ne jamais afficher un objet erreur brut :
 * Node listerait toutes ses propriétés (domSnippet, interactiveTexts...), potentiellement des données réelles.
 */
export function sanitizeErrorMessage(message = '') {
  const first = String(message).split('\n')[0].replace(/https?:\/\/\S+/g, '<URL>').trim();
  return first.length > 300 ? `${first.slice(0, 300)}…` : first;
}
