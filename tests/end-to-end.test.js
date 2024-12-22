process.env.NODE_ENV = 'test';

const { processGpxFiles } = require('../scripts/process-gpx');
const { sanitizeGpxFileNames } = require('../scripts/sanitize-gpx');
const fs = require('fs');
const path = require('path');

describe('End-to-end filename processing', () => {
  const exampleGpxFilesDir = path.join(__dirname, '../example-gpx');
  const gpxFilesDir = path.join(__dirname, '../gpx-files');
  const outputFilePath = path.join(__dirname, '../data/traces.json');

  beforeAll(() => {
    // Ensure the example-gpx directory exists
    if (!fs.existsSync(exampleGpxFilesDir)) {
      fs.mkdirSync(exampleGpxFilesDir);
    }

    // Create sample GPX files for testing in alphabetical order
    const sampleGpxContent0 = `
    <gpx>
      <trk>
        <name>Chemin boueux - La valinière</name>
        <trkseg>
          <trkpt lat="47.325" lon="-1.736"></trkpt>
          <trkpt lat="47.326" lon="-1.737"></trkpt>
        </trkseg>
      </trk>
    </gpx>
  `;
  fs.writeFileSync(path.join(exampleGpxFilesDir, 'Chemin boueux - La valinière.gpx'), sampleGpxContent0);

    const sampleGpxContent1 = `
      <gpx>
        <trk>
          <name>Sample Track</name>
          <trkseg>
            <trkpt lat="47.325" lon="-1.736"></trkpt>
            <trkpt lat="47.326" lon="-1.737"></trkpt>
          </trkseg>
        </trk>
      </gpx>
    `;
    fs.writeFileSync(path.join(exampleGpxFilesDir, 'Sample Track.gpx'), sampleGpxContent1);
  });

  afterAll(() => {
    // Clean up the example-gpx directory and traces.json file
    fs.readdirSync(exampleGpxFilesDir).forEach((file) => {
      fs.unlinkSync(path.join(exampleGpxFilesDir, file));
    });
    if (fs.existsSync(outputFilePath)) {
      fs.unlinkSync(outputFilePath);
    }
  });

  test('sanitizes, categorizes, processes, and displays the filename correctly', async () => {
    // Process GPX files
    await processGpxFiles();

    // Check the sanitized file names
    const sanitizedFileName0 = 'chemin_boueux___la_valiniere.gpx';
    const sanitizedFileName1 = 'sample_track.gpx';
    expect(fs.existsSync(path.join(gpxFilesDir, sanitizedFileName0))).toBe(true);
    expect(fs.existsSync(path.join(gpxFilesDir, sanitizedFileName1))).toBe(true);

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
