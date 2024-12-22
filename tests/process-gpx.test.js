process.env.NODE_ENV = 'test';

const { getCategory, getCoordinates } = require('../scripts/process-gpx');

describe('getCategory', () => {
  test('returns correct category for parcours', () => {
    expect(getCategory('parcours')).toBe('parcours');
  });

  test('returns correct category for chemin_boueux', () => {
    expect(getCategory('chemin_boueux')).toBe('chemin_boueux');
  });

  test('returns correct category for chemin_inondable', () => {
    expect(getCategory('chemin_inondable')).toBe('chemin_inondable');
  });

  test('returns correct category for danger', () => {
    expect(getCategory('danger')).toBe('danger');
  });

  test('returns correct category for autres', () => {
    expect(getCategory('autres')).toBe('autres');
  });
});

describe('getCoordinates', () => {
  test('returns correct coordinates', () => {
    const trkpts = [
      { $: { lat: '47.325', lon: '-1.736' } },
      { $: { lat: '47.326', lon: '-1.737' } }
    ];
    const expectedCoordinates = [
      { lat: 47.325, lon: -1.736 },
      { lat: 47.326, lon: -1.737 }
    ];
    expect(getCoordinates(trkpts)).toEqual(expectedCoordinates);
  });
});
