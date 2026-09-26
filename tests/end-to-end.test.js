jest.setTimeout(10000);

process.env.NODE_ENV = 'test';

const { processGpxFiles } = require('../scripts/process-gpx');
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

describeIfDrive('End-to-end filename processing', () => {
  const gpxFilesDir = path.join(__dirname, '../gpx-files-end-to-end');
  const tracesFilePath = path.join(
    __dirname,
    '../traces-end-to-end/traces.json'
  );

  afterAll(() => {
    // Clean up the gpx-files directory and traces.json file
    fs.readdirSync(gpxFilesDir).forEach((file) => {
      fs.unlinkSync(path.join(gpxFilesDir, file));
    });
    if (fs.existsSync(tracesFilePath)) {
      fs.unlinkSync(tracesFilePath);
    }
  });

  test('sanitizes, categorizes, processes, and displays the filename correctly', async () => {
    // Process GPX files
    await processGpxFiles(gpxFilesDir, tracesFilePath);

    // Check the sanitized file names
    const sanitizedFileName0 = 'chemin_boueux___la_valiniere.gpx';
    const sanitizedFileName1 = 'sample_track.gpx';
    expect(fs.existsSync(path.join(gpxFilesDir, sanitizedFileName0))).toBe(
      true
    );
    expect(fs.existsSync(path.join(gpxFilesDir, sanitizedFileName1))).toBe(
      true
    );

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
