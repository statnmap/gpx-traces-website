jest.setTimeout(10000);

process.env.NODE_ENV = 'test';

const {
  getCategory,
  getDistanceKm,
  getCoordinates,
  processGpxFiles,
  simplifyCoordinates,
} = require('../scripts/process-gpx');
const fs = require('fs');
const path = require('path');
const { toBeCloseToCoordinates } = require('./customMatchers');
const { expectTestTraces } = require('./driveTestData');

expect.extend({ toBeCloseToCoordinates });

// Google Drive tests need credentials.json and a test folder id. They are not
// available on Dependabot PRs, so skip instead of failing.
const hasDriveAccess =
  fs.existsSync(path.join(__dirname, '../credentials.json')) &&
  Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID_TEST);
const describeIfDrive = hasDriveAccess ? describe : describe.skip;

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

describe('getDistanceKm', () => {
  test.each([
    ['Parcours - 10km - Cens - Bongarant', 10],
    ['parcours - 7km - plutôt sec, de la route ok', 7],
    ['Parcours un peu boueux-mais-ok_8km_La-Paquelais_Valais', 8],
    ['Parcours - 9 KM - majuscules', 9],
    ['Parcours - 9kms - pluriel', 9],
    ['Parcours - 8,5 km - virgule', 8.5],
    ['Parcours - 12.5km - point', 12.5],
  ])('reads the distance in "%s"', (name, expected) => {
    expect(getDistanceKm(name)).toBe(expected);
  });

  test.each([
    'parcours - La Roche via La Gaudinière, Haymionniere et Babiniere',
    'Parcours - km 3 - pas une distance',
    'Parcours - 10kmh - pas une distance',
  ])('returns null without distance in "%s"', (name) => {
    expect(getDistanceKm(name)).toBeNull();
  });
});

describe('getCoordinates', () => {
  test('returns correct coordinates', () => {
    const trkpts = [
      { $: { lat: '47.325', lon: '-1.736' } },
      { $: { lat: '47.326', lon: '-1.737' } },
    ];
    const expectedCoordinates = [
      { lat: 47.325, lon: -1.736 },
      { lat: 47.326, lon: -1.737 },
    ];
    expect(getCoordinates(trkpts)).toBeCloseToCoordinates(
      expectedCoordinates,
      3
    );
  });
});

describe('simplifyCoordinates', () => {
  test('simplifies coordinates correctly', () => {
    const coordinates = [
      { lat: 47.325, lon: -1.736 },
      { lat: 47.3251, lon: -1.7361 },
      { lat: 47.326, lon: -1.737 },
    ];
    const expectedSimplifiedCoordinates = [
      { lat: 47.325, lon: -1.736 },
      { lat: 47.326, lon: -1.737 },
    ];
    expect(simplifyCoordinates(coordinates)).toBeCloseToCoordinates(
      expectedSimplifiedCoordinates,
      3
    );
  });
});

describeIfDrive('Google Drive integration', () => {
  const gpxFilesDir = path.join(__dirname, '../gpx-files-process');
  const tracesFilePath = path.join(__dirname, '../traces-process/traces.json');

  afterAll(() => {
    // Clean up the gpx-files directory and traces.json file
    fs.readdirSync(gpxFilesDir).forEach((file) => {
      fs.unlinkSync(path.join(gpxFilesDir, file));
    });
    if (fs.existsSync(tracesFilePath)) {
      fs.unlinkSync(tracesFilePath);
    }
  });

  test('downloads and processes GPX files from Google Drive', async () => {
    // Process GPX files
    await processGpxFiles(gpxFilesDir, tracesFilePath);

    // Check the traces.json file
    expect(fs.existsSync(tracesFilePath)).toBe(true);
    const tracesJson = JSON.parse(fs.readFileSync(tracesFilePath, 'utf8'));
    expectTestTraces(tracesJson.traces);
  });
});
