jest.setTimeout(10000);

process.env.NODE_ENV = 'test';

const { getCategory, getCoordinates, processGpxFiles } = require('../scripts/process-gpx');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

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

describe('Google Drive integration', () => {
  const gpxFilesDir = path.join(__dirname, '../gpx-files-process');
  const outputFilePath = path.join(__dirname, '../data/traces.json');

  afterAll(() => {
    // Clean up the gpx-files directory and traces.json file
    fs.readdirSync(gpxFilesDir).forEach((file) => {
      fs.unlinkSync(path.join(gpxFilesDir, file));
    });
    if (fs.existsSync(outputFilePath)) {
      fs.unlinkSync(outputFilePath);
    }
  });

  test('downloads and processes GPX files from Google Drive', async () => {
    // Process GPX files
    await processGpxFiles(gpxFilesDir);

    // Check the traces.json file
    expect(fs.existsSync(outputFilePath)).toBe(true);
    const tracesJson = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
    expect(tracesJson.traces).toHaveLength(2);

    // Check the trace 0
    expect(tracesJson.traces[0].name).toBe('Chemin boueux - La valinière');
    expect(tracesJson.traces[0].sanitizedName).toBe('chemin_boueux___la_valiniere');
    expect(tracesJson.traces[0].category).toBe('chemin_boueux');
    expect(tracesJson.traces[0].coordinates).toEqual([
      { lat: 47.325, lon: -1.736 },
      { lat: 47.326, lon: -1.737 }
    ]);
    
    // Check the trace 1
    expect(tracesJson.traces[1].name).toBe('Sample Track');
    expect(tracesJson.traces[1].sanitizedName).toBe('sample_track');
    expect(tracesJson.traces[1].category).toBe('autres');
    expect(tracesJson.traces[1].coordinates).toEqual([
      { lat: 47.325, lon: -1.736 },
      { lat: 47.326, lon: -1.737 }
    ]);
  });
});
