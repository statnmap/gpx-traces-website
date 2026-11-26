// Test de tests/shared/text-match.js : `node --test tests/shared/` (aucun navigateur requis).
import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, labelRegex, includesLabel } from './text-match.js';

test('norm : accents, casse, espaces, apostrophes', () => {
  assert.equal(norm('  Éléments   de l’Équipe '), "elements de l'equipe");
  assert.equal(norm('été'), 'ete'); // accents décomposés
  assert.equal(norm(null), '');
});

test('labelRegex : insensible aux accents, casse, espaces et apostrophes', () => {
  assert.ok(labelRegex('Créer une catégorie').test('CREER  UNE   CATEGORIE'));
  assert.ok(labelRegex("L'équipe").test('l’equipe'));
  assert.ok(labelRegex('Éléments').test('éléments'));
  assert.ok(!labelRegex('Catégorie').test('Archives'));
});

test('labelRegex : caractères spéciaux pris littéralement', () => {
  assert.ok(labelRegex('Prix (TTC) ?').test('prix (ttc) ?'));
  assert.ok(!labelRegex('a.c').test('abc'));
});

test('includesLabel', () => {
  assert.ok(includesLabel('Bienvenue, Éric', 'eric'));
  assert.ok(!includesLabel('Bienvenue', 'au revoir'));
});
