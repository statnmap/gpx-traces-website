/**
 * Garde-fou commun à tout le projet (sessions web, load-config, hook Claude Code) :
 * ne jamais naviguer en production. Seul le HOSTNAME compte — un "preprod" dans le chemin, la query
 * ou les credentials d'une URL de prod ne doit pas la faire passer.
 *
 * Les motifs d'hôte autorisés sont configurables : variable RECETTE_ALLOWED_HOST_PATTERNS
 * (liste séparée par des virgules, ex. `preprod,pp-,staging`), lue dans l'environnement puis, à défaut,
 * dans `.env`. Défaut : `preprod,pp-`. Ce module n'importe rien (il est aussi chargé par le hook
 * scripts/hooks/guard-preprod.mjs, hors du runner).
 */
import { readFileSync } from 'node:fs';

const DEFAULT_PATTERNS = 'preprod,pp-';

/** Lit une clé (non secrète) dans `.env` sans jamais la logger ; null si absente. */
function readEnvFileKey(key) {
  try {
    const m = readFileSync('.env', 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^(['"])(.*)\1$/, '$2') : null;
  } catch {
    return null;
  }
}

/** Motifs d'hôte autorisés (minuscules), configurables, avec repli sur `preprod,pp-`. */
export function allowedHostPatterns() {
  const raw = process.env.RECETTE_ALLOWED_HOST_PATTERNS || readEnvFileKey('RECETTE_ALLOWED_HOST_PATTERNS') || DEFAULT_PATTERNS;
  const patterns = raw.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  return patterns.length ? patterns : DEFAULT_PATTERNS.split(',');
}

export function isPreprodUrl(url) {
  let hostname;
  try {
    hostname = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedHostPatterns().some((p) => hostname.includes(p));
}

export function assertPreprod(url, source = 'recette') {
  if (!isPreprodUrl(url)) {
    throw new Error(`[${source}] Hôte non autorisé (production ?) : arrêt immédiat. Motifs autorisés : ${allowedHostPatterns().join(', ')}.`);
  }
}
