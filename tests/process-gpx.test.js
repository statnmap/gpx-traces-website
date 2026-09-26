jest.setTimeout(10000);

process.env.NODE_ENV = 'test';

const {
  getCategory,
  getCoordinates,
  processGpxFiles,
  simplifyCoordinates,
} = require('../scripts/process-gpx');
const fs = require('fs');
const path = require('path');
const { toBeCloseToCoordinates } = require('./customMatchers');

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
    expect(tracesJson.traces).toHaveLength(2);

    // Check the trace 0
    expect(tracesJson.traces[0].name).toBe('Chemin boueux - La valinière');
    expect(tracesJson.traces[0].sanitizedName).toBe(
      'chemin_boueux___la_valiniere'
    );
    expect(tracesJson.traces[0].category).toBe('chemin_boueux');
    expect(tracesJson.traces[0].coordinates).toBeCloseToCoordinates(
      [
        { lat: 47.325, lon: -1.736 },
        { lat: 47.326, lon: -1.737 },
      ],
      3
    );

    // Check the trace 1
    expect(tracesJson.traces[1].name).toBe('Sample Track');
    expect(tracesJson.traces[1].sanitizedName).toBe('sample_track');
    expect(tracesJson.traces[1].category).toBe('autres');
    expect(tracesJson.traces[1].coordinates).toBeCloseToCoordinates(
      [
        { lat: 47.325, lon: -1.736 },
        { lat: 47.326, lon: -1.737 },
      ],
      3
    );
  });
});
