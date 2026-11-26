#!/usr/bin/env node
// Fenêtre Chromium dédiée à la recette : lancée UNE fois, laissée ouverte, réutilisée par tous les scripts
// (même fenêtre, même session) via le Chrome DevTools Protocol sur 127.0.0.1 uniquement. Aucune position
// imposée : l'OS la place, chacun la déplace où il veut (elle garde sa place tant qu'elle reste ouverte).
// Port par défaut 9333, modifiable via RECETTE_WINDOW_PORT.
//
// Usage :
//   node src/recette-window.mjs start [storage-state.json]
//       lance la fenêtre si absente ; si un fichier de session (login-preprod.mjs) est donné, y injecte ses
//       cookies (jamais le login/mot de passe)
//   node src/recette-window.mjs stop
//
// Dans un script de recette (ne pas appeler browser.close(), qui fermerait la fenêtre partagée) :
//   const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
//   const ctx = browser.contexts()[0]; const page = ctx.pages()[0] ?? await ctx.newPage();
//   ... puis process.exit(0) en fin de script.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const PORT = Number(process.env.RECETTE_WINDOW_PORT) || 9333;
const ENDPOINT = `http://127.0.0.1:${PORT}`;
const PROFILE = 'outputs/.auth/recette-window-profile'; // gitignoré (outputs/)

const [, , cmd, ...rest] = process.argv;
const statePath = rest[0];

const isUp = async () => { try { return (await fetch(`${ENDPOINT}/json/version`)).ok; } catch { return false; } };

if (cmd === 'start') {
  if (!(await isUp())) {
    mkdirSync(PROFILE, { recursive: true });
    const args = [
      `--remote-debugging-port=${PORT}`, '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
      'about:blank',
    ];
    spawn(chromium.executablePath(), args, { detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 40 && !(await isUp()); i++) await new Promise(r => setTimeout(r, 250));
    if (!(await isUp())) { console.error('Fenêtre non démarrée.'); process.exit(1); }
  }
  if (statePath) {
    const { cookies } = JSON.parse(readFileSync(statePath, 'utf8'));
    const browser = await chromium.connectOverCDP(ENDPOINT);
    await browser.contexts()[0].addCookies(cookies);
    console.log(`Fenêtre prête, ${cookies.length} cookies de session injectés.`);
  } else {
    console.log('Fenêtre prête.');
  }
  process.exit(0);
} else if (cmd === 'stop') {
  if (await isUp()) { const b = await chromium.connectOverCDP(ENDPOINT); await b.close(); console.log('Fenêtre fermée.'); }
  else console.log('Aucune fenêtre ouverte.');
  process.exit(0);
} else {
  console.error('Usage: node src/recette-window.mjs start [storage-state.json] | stop');
  process.exit(1);
}
