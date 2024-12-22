process.env.NODE_ENV = 'test';

const { getColor, getWeight } = require('../scripts/map');
const fs = require('fs');
const path = require('path');

describe('getColor', () => {
  test('returns correct color for parcours category', () => {
    expect(getColor('parcours')).toBe('#35978f');
  });

  test('returns correct color for chemin_boueux category', () => {
    expect(getColor('chemin_boueux')).toBe('#542788');
  });

  test('returns correct color for chemin_inondable category', () => {
    expect(getColor('chemin_inondable')).toBe('#fdb863');
  });

  test('returns correct color for danger category', () => {
    expect(getColor('danger')).toBe('#b30000');
  });

  test('returns correct color for autres category', () => {
    expect(getColor('autres')).toBe('pink');
  });
});

describe('getWeight', () => {
  test('returns correct weight for parcours category', () => {
    expect(getWeight('parcours')).toBe(8);
  });

  test('returns correct weight for chemin_boueux category', () => {
    expect(getWeight('chemin_boueux')).toBe(10);
  });

  test('returns correct weight for chemin_inondable category', () => {
    expect(getWeight('chemin_inondable')).toBe(10);
  });

  test('returns correct weight for danger category', () => {
    expect(getWeight('danger')).toBe(11);
  });

  test('returns correct weight for autres category', () => {
    expect(getWeight('autres')).toBe(8);
  });
});

