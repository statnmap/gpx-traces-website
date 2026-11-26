/**
 * Lecture des configurations de recette. Un dossier de recette = un projet (un Front + un back-office reliés).
 * Source prioritaire : variables d'environnement (.env local, jamais commité, ou CI).
 * Repli : fichiers config/{front,backoffice}/*.md, qui ne contiennent QUE des références
 * `_(voir `.env`, variable `RECETTE_...`)_` — jamais de valeur réelle. Une référence est résolue ici
 * dans process.env ; une référence dont la variable est absente vaut « non renseigné ».
 *
 * Variables d'environnement :
 *   RECETTE_URL                   — URL du site Front
 *   RECETTE_LOGIN_URL             — URL de connexion du Front (optionnel : absent = Front anonyme, sans connexion)
 *   RECETTE_LOGIN                 — Identifiant du compte de test Front (optionnel)
 *   RECETTE_PASSWORD              — Mot de passe du compte de test Front (optionnel)
 *   RECETTE_BO_URL                — URL du back-office
 *   RECETTE_BO_LOGIN_URL          — URL de connexion du back-office (optionnel — défaut : l'URL du BO)
 *   RECETTE_BO_LOGIN              — Identifiant du compte de test back-office
 *   RECETTE_BO_PASSWORD           — Mot de passe du compte de test back-office
 *   RECETTE_HTTP_LOGIN / RECETTE_HTTP_PASSWORD — HTTP Basic Auth du preprod (optionnel)
 *   RECETTE_ALLOWED_HOST_PATTERNS — motifs d'hôte autorisés (défaut `preprod,pp-`, voir tests/shared/assert-preprod.js)
 *   RECETTE_CI                    — masque les URL dans les rapports (aussi vrai si la variable CI standard est définie)
 *
 * Règle de sécurité : toute URL retournée est vérifiée contre les motifs d'hôte autorisés — à l'exception de
 * `loginUrl` (voir loadSite()) : le portail de connexion d'un tiers n'a pas forcément ce type de nom de domaine ;
 * l'utilisateur reste responsable de vérifier qu'il s'agit bien d'un environnement de test.
 * Ne jamais logger les valeurs retournées par loadSecrets() et loadBoSecrets().
 */

import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { assertPreprod as assertAllowedHost } from '../tests/shared/assert-preprod.js';

// quiet : dotenv v17 écrit sinon un message d'information sur la sortie standard.
dotenv.config({ quiet: true });

const trimSlash = (u) => (u ? String(u).replace(/\/$/, '') : null);

function readFirst(paths) {
  const found = paths.find((p) => existsSync(p));
  return found ? readFileSync(found, 'utf8') : '';
}

function field(content, label) {
  const match = content.match(new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*(.+)`));
  return match ? match[1].trim() : null;
}

/**
 * Valeur d'un champ de fichier de config : une référence `.env` est résolue dans process.env (null si la
 * variable est absente) ; un gabarit « (à renseigner) » vaut null ; toute autre valeur est rendue telle quelle.
 */
function resolveRef(value) {
  if (!value) return null;
  if (/voir\s+`\.env`/.test(value)) {
    const ref = value.match(/variable\s+`([A-Z0-9_]+)`/);
    return ref ? process.env[ref[1]] || null : null;
  }
  if (/^\(.*\)$/.test(value)) return null;
  return value;
}

/** Variable d'environnement d'abord, sinon champ du fichier de config (référence `.env` résolue). */
function pick(envName, content, label) {
  return process.env[envName] || resolveRef(field(content, label));
}

/**
 * Retourne true si le process tourne en CI (variable CI standard ou RECETTE_CI).
 * En CI, les URLs ne doivent pas apparaître dans les rapports — utiliser reportUrl() à la place.
 */
export function isCI() {
  return !!(process.env.CI || process.env.RECETTE_CI);
}

/**
 * Retourne une représentation de l'URL sûre pour les rapports.
 * En CI : masque l'URL complète. En local : retourne l'URL complète (utile pour debug).
 */
export function reportUrl(url) {
  if (isCI()) return '[URL masquée]';
  return url;
}

function loadSite(scope) {
  const dir = `config/${scope}`;
  const prefix = scope === 'backoffice' ? 'RECETTE_BO' : 'RECETTE';
  const content = readFirst([`${dir}/site.md`]);

  const url = trimSlash(pick(`${prefix}_URL`, content, 'URL principale'));
  if (!url) {
    throw new Error(`[load-config] URL ${scope} introuvable : définir ${prefix}_URL dans .env, ou créer ${dir}/site.md depuis ${dir}/site.example.md`);
  }
  assertAllowedHost(url, `URL ${scope}`);

  // Champ optionnel — URL du portail de connexion à visiter avant l'URL principale. Volontairement PAS de
  // assertPreprod() ici, voir note de sécurité en tête de fichier.
  const loginUrl = trimSlash(pick(`${prefix}_LOGIN_URL`, content, 'URL de connexion'));
  return { url, loginUrl };
}

function loadLogin(scope, envLogin, envPassword) {
  const content = readFirst([`config/${scope}/secrets.md`]);
  return {
    login: pick(envLogin, content, 'Identifiant'),
    password: pick(envPassword, content, 'Mot de passe'),
  };
}

/**
 * Config du site Front → { url, loginUrl }.
 * Priorité : RECETTE_URL / RECETTE_LOGIN_URL → config/front/site.md
 */
export function loadSiteConfig() {
  return loadSite('front');
}

/**
 * Identifiants du compte de test Front → { login, password } (null si non renseignés).
 * Priorité : RECETTE_LOGIN / RECETTE_PASSWORD → config/front/secrets.md
 * Ne jamais logger les valeurs retournées.
 */
export function loadSecrets() {
  return loadLogin('front', 'RECETTE_LOGIN', 'RECETTE_PASSWORD');
}

/**
 * HTTP Basic Auth du preprod → { username, password } ou undefined si non configuré.
 */
export function loadHttpCredentials() {
  const content = readFirst(['config/front/secrets.md']);
  const username = pick('RECETTE_HTTP_LOGIN', content, 'Login HTTP Basic Auth');
  if (!username) return undefined;
  return { username, password: pick('RECETTE_HTTP_PASSWORD', content, 'Mot de passe HTTP Basic Auth') ?? '' };
}

/**
 * Config du back-office → { url, loginUrl }.
 * Priorité : RECETTE_BO_URL / RECETTE_BO_LOGIN_URL → config/backoffice/site.md
 */
export function loadBoConfig() {
  return loadSite('backoffice');
}

/**
 * Identifiants du compte de test back-office → { login, password } (null si non renseignés).
 * Priorité : RECETTE_BO_LOGIN / RECETTE_BO_PASSWORD → config/backoffice/secrets.md
 * Ne jamais logger les valeurs retournées.
 */
export function loadBoSecrets() {
  return loadLogin('backoffice', 'RECETTE_BO_LOGIN', 'RECETTE_BO_PASSWORD');
}

/**
 * Le back-office est-il utilisable par un scénario croisé ? → { ok, reason }.
 * Vérifie uniquement la PRÉSENCE de l'URL et des identifiants (jamais leurs valeurs affichées) ; ne lève pas.
 */
export function boAvailability() {
  try {
    loadBoConfig();
  } catch {
    return { ok: false, reason: 'RECETTE_BO_URL absente (ou hôte non autorisé)' };
  }
  const { login, password } = loadBoSecrets();
  if (!login || !password) return { ok: false, reason: 'RECETTE_BO_LOGIN / RECETTE_BO_PASSWORD absents' };
  return { ok: true, reason: null };
}
