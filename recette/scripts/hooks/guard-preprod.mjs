#!/usr/bin/env node
/**
 * Hook Claude Code PreToolUse — bloque toute navigation MCP vers une URL dont l'hôte ne correspond à aucun
 * motif autorisé (RECETTE_ALLOWED_HOST_PATTERNS, défaut `preprod,pp-`), quelle que soit la commande en cours.
 * Branché dans .claude/settings.json sur les outils de navigation (Playwright MCP, Claude in Chrome).
 * Entrée : JSON du hook sur stdin. Sortie : code 2 + message stderr = appel bloqué.
 *
 * Ne couvre que l'URL demandée : une redirection ou un clic vers un site externe (partenaire)
 * n'est pas vu ici — vérifier l'hôte avant chaque étape sensible.
 */
import { readFileSync } from 'node:fs';
import { isPreprodUrl, allowedHostPatterns } from '../../tests/shared/assert-preprod.js';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};

// browser_tabs : seule l'action "new" porte une URL ; navigate/tabs_create_mcp : toujours.
if (tool.endsWith('browser_tabs') && args.action !== 'new') process.exit(0);

const url = args.url;
if (!url) process.exit(0); // "new" sans URL = onglet vide

if (!isPreprodUrl(url)) {
  console.error(
    `⛔ Navigation bloquée : l'hôte de "${String(url).replace(/\/\/[^@/]*@/, '//***@')}" ne correspond à aucun motif autorisé ` +
      `(${allowedHostPatterns().join(', ')}). Pas de test en production.`,
  );
  process.exit(2);
}
process.exit(0);
