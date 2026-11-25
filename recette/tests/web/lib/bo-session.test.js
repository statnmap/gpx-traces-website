// Test du garde-fou d'écriture du back-office (liste blanche des POST de lecture) : `npm test`. Aucun navigateur lancé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathMatches, makeWriteGuard, loadGuardrails } from './bo-session.js';

test('pathMatches : chemin exact, jokers simples, pas de regex libre', () => {
  assert.ok(pathMatches('/api/list.json', '/api/list.json'));
  assert.ok(!pathMatches('/api/list.json', '/api/listxjson'));      // le point est littéral
  assert.ok(pathMatches('/api/*/rows', '/api/items/rows'));
  assert.ok(!pathMatches('/api/*/rows', '/api/a/b/rows'));          // * = un seul segment
  assert.ok(pathMatches('/api/**', '/api/a/b/c'));                  // ** = plusieurs segments
  assert.ok(!pathMatches('/api/**', '/api'));
  assert.ok(pathMatches('/api/list/', '/api/list'));                // slash final ignoré
  assert.ok(!pathMatches('/api/(a|b)', '/api/a'));                  // pas de regex
});

function fakeRoute(method, url) {
  const calls = { aborted: false, continued: false };
  return { calls, request: () => ({ method: () => method, url: () => url }), abort: () => { calls.aborted = true; }, continue: () => { calls.continued = true; } };
}

test('makeWriteGuard : lecture bloque les écritures sauf POST de lecture listés', () => {
  let v = 0;
  const guard = makeWriteGuard({ readPosts: ['/list.json', '/rows/*'] }, () => 'lecture', () => { v += 1; });
  const cases = [['GET', '/x', false], ['POST', '/list.json', false], ['POST', '/rows/a', false], ['POST', '/other', true], ['PUT', '/list.json', true], ['DELETE', '/rows/a', true]];
  for (const [m, p, blocked] of cases) {
    const r = fakeRoute(m, `http://localhost${p}?q=1`);
    guard(r);
    assert.equal(r.calls.aborted, blocked, `${m} ${p}`);
  }
  assert.equal(v, 3);
});

test('makeWriteGuard : écriture-limitee laisse tout passer', () => {
  const guard = makeWriteGuard({ readPosts: [] }, () => 'ecriture-limitee', () => assert.fail());
  const r = fakeRoute('POST', 'http://localhost/any');
  guard(r);
  assert.ok(r.calls.continued);
});

test('loadGuardrails : ligne « POST de lecture autorisés »', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gr-'));
  mkdirSync(path.join(dir, 'config/backoffice'), { recursive: true });
  writeFileSync(path.join(dir, 'config/backoffice/guardrails.md'),
    '**Écriture limitée autorisée** : non\n**POST de lecture autorisés** : /a.json, `/b/*`, pas-un-chemin\n');
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const g = loadGuardrails();
    assert.deepEqual(g.readPosts, ['/a.json', '/b/*']);
    assert.equal(g.allowWrite, false);
  } finally { process.chdir(cwd); }
  assert.deepEqual(loadGuardrails().readPosts, []); // fichier absent
});
