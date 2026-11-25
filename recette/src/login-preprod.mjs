#!/usr/bin/env node
// Authentifie une session Playwright sur un environnement preprod (back-office ou Front) à partir de .env,
// SANS jamais afficher le login/mot de passe : ce process les lit, les tape dans le formulaire, puis les jette.
// Seul le fichier de session (storageState : cookies + localStorage, pas les identifiants) est écrit sur disque,
// sous outputs/.auth/<scope>.json (gitignoré). Réutiliser ce fichier dans une session Playwright normale pour continuer
// la recette de façon interactive, déjà authentifié.
//
// Usage : node src/login-preprod.mjs <front|backoffice> [--manuel] [storage-state-path]
//   --manuel    : login MANUEL de secours (SSO, 2FA, captcha impossibles à scripter). Ouvre un Chromium VISIBLE sur l'URL
//                 de connexion ; l'utilisateur se connecte lui-même ; le script attend la fin de connexion puis sauvegarde le
//                 storageState. Il ne lit, ne tape et n'affiche JAMAIS les identifiants (RECETTE_LOGIN/PASSWORD ignorés).
//                 Fin de connexion : RECETTE_LOGIN_DONE_URL_PATTERN (expression régulière testée sur l'URL ; jamais affichée)
//                 et/ou RECETTE_LOGIN_DONE_SELECTOR (élément visible seulement une fois connecté) ; sans l'un ni l'autre,
//                 `page.pause()` : se connecter puis cliquer sur « Resume » dans l'Inspector. Délai max : RECETTE_LOGIN_TIMEOUT_S (300).
//                 Nécessite un affichage (pas de serveur sans écran).
// (Logique du mode manuel partagée avec l'ouverture de session du runner : tests/shared/manual-login.js ; le runner
// l'utilise lui-même en repli quand la connexion automatique échoue — voir AGENTS.md § Authentification.)
// Règle : ne PAS relancer l'authentification si outputs/.auth/<scope>.json existe et reste valide ; ré-authentifier
// seulement sur constat d'échec (redirection vers la page de connexion), jamais préventivement.
//   front       : URL = RECETTE_LOGIN_URL (sinon RECETTE_URL), identifiants RECETTE_LOGIN / RECETTE_PASSWORD
//   backoffice  : URL = RECETTE_BO_LOGIN_URL (sinon RECETTE_BO_URL), identifiants RECETTE_BO_LOGIN / RECETTE_BO_PASSWORD
//   Fichier de session par défaut : outputs/.auth/<scope>.json
//
// Le formulaire est repéré de façon générique (champ identifiant, champ mot de passe, bouton de validation) ;
// adapter les trois repérages ci-dessous si le formulaire cible est atypique. Voir AGENTS.md § « Connexion autonome ».
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { isPreprodUrl, allowedHostPatterns } from '../tests/shared/assert-preprod.js';
import { waitForManualLogin } from '../tests/shared/manual-login.js';

dotenv.config({ quiet: true });

const argv = process.argv.slice(2);
const manual = argv.includes('--manuel');
const [scope, storagePathArg] = argv.filter((a) => !a.startsWith('--'));
const VARS = {
  front: { urls: ['RECETTE_LOGIN_URL', 'RECETTE_URL'], login: 'RECETTE_LOGIN', password: 'RECETTE_PASSWORD' }, // hook-allow-literal : noms de variables, pas des valeurs
  backoffice: { urls: ['RECETTE_BO_LOGIN_URL', 'RECETTE_BO_URL'], login: 'RECETTE_BO_LOGIN', password: 'RECETTE_BO_PASSWORD' }, // hook-allow-literal : noms de variables, pas des valeurs
}[scope];

if (!VARS) {
  console.error('Usage: node src/login-preprod.mjs <front|backoffice> [--manuel] [storage-state-path]');
  process.exit(1);
}

const urlVar = VARS.urls.find((v) => process.env[v]);
const url = urlVar ? process.env[urlVar] : null;
if (!url || !isPreprodUrl(url)) {
  console.error(`Refusé : ${VARS.urls.join(' / ')} absente ou hôte ne correspondant à aucun motif autorisé (${allowedHostPatterns().join(', ')}) — connexion annulée.`);
  process.exit(1);
}

// Mode manuel : les identifiants ne sont jamais lus (l'utilisateur les saisit dans la fenêtre).
const login = manual ? null : process.env[VARS.login];
const password = manual ? null : process.env[VARS.password];
if (!manual && (!login || !password)) {
  console.error(`${VARS.login} ou ${VARS.password} manquant(e) dans .env`);
  process.exit(1);
}

const storagePath = storagePathArg || `outputs/.auth/${scope}.json`;
mkdirSync('outputs/.auth', { recursive: true });

let browser;
try {
  browser = await chromium.launch({ headless: manual ? false : !process.env.RECETTE_HEADED });
} catch (e) {
  console.error(`ÉCHEC — navigateur impossible à lancer${manual ? ' (le mode --manuel exige un affichage graphique)' : ''} : ${String(e.message).split('\n')[0].replace(/https?:\/\/\S+/g, '<URL>')}`);
  process.exit(1);
}
const context = await browser.newContext();
const page = await context.newPage();
const passwordField = page.locator('input[type="password"]').first();

try {
  await page.goto(url);
  if (manual) {
    await waitForManualLogin(page);
    await page.waitForLoadState('networkidle').catch(() => {});
  } else {
    await page.locator('input[type="email"], input[name*="mail" i], input[name*="login" i], input[name*="user" i], input[type="text"]').first().fill(login);
    await passwordField.fill(password);
    const submit = page.locator('button[type="submit"], input[type="submit"]').first();
    if (await submit.count()) await submit.click();
    else await page.getByRole('button', { name: /connexion|connecter|login|sign in|valider/i }).first().click();
    await page.waitForLoadState('networkidle').catch(() => {});

    // 2FA TOTP éventuelle. Le code, valable ~30 s, est fourni par l'utilisateur juste avant le lancement via
    // RECETTE_2FA_CODE (jamais stocké ; inutile pour les environnements sans 2FA).
    if (/two-factor|2fa|mfa|otp/i.test(page.url())) {
      const code = process.env.RECETTE_2FA_CODE;
      if (!code) {
        console.error('2FA requise — relancer avec RECETTE_2FA_CODE=<code frais>. Session non sauvegardée.');
        process.exitCode = 2;
        throw new Error('2fa-code-missing');
      }
      await page.locator('input[autocomplete="one-time-code"], input[type="text"], input[type="number"], input[type="tel"]').first().fill(code);
      const confirm = page.getByRole('button', { name: /valider|vérifier|confirmer|envoyer|se connecter/i }).first();
      if (await confirm.count()) await confirm.click(); else await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    if (/update-password|change-password|reset-password/i.test(page.url())) {
      console.error('Changement de mot de passe obligatoire — action d\'écriture, à traiter avec l\'utilisateur. Session non sauvegardée.');
      process.exitCode = 3;
      throw new Error('update-password');
    }
  }

  // Un champ mot de passe encore visible = connexion refusée. L'URL finale n'est volontairement pas affichée.
  const loggedIn = !(await passwordField.isVisible().catch(() => false));
  await context.storageState({ path: storagePath });

  if (loggedIn) {
    console.log(`OK — session authentifiée sauvegardée dans ${storagePath}`);
  } else {
    console.error('ÉCHEC — le formulaire de connexion est toujours affiché après la tentative (identifiants invalides ou étape supplémentaire).');
    process.exitCode = 1;
  }
} catch (e) {
  if (e.message === 'manual-login-timeout') {
    console.error('ÉCHEC — fin de connexion non détectée avant le délai (vérifier RECETTE_LOGIN_DONE_URL_PATTERN / RECETTE_LOGIN_DONE_SELECTOR). Session non sauvegardée.');
    process.exitCode = 1;
  } else if (!['2fa-code-missing', 'update-password'].includes(e.message)) {
    // Jamais d'erreur brute : le « Call log » Playwright contient l'URL visitée.
    console.error(`ÉCHEC — ${String(e.message).split('\n')[0].replace(/https?:\/\/\S+/g, '<URL>')}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
