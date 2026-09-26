jest.setTimeout(10000);

process.env.NODE_ENV = 'test';

const { processGpxFiles } = require('../scripts/process-gpx');
const fs = require('fs');
const path = require('path');
const { toBeCloseToCoordinates } = require('./customMatchers');
const { expectedTestTraces, expectTestTraces } = require('./driveTestData');

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
    for (const { sanitizedName } of expectedTestTraces) {
      expect(
        fs.existsSync(path.join(gpxFilesDir, `${sanitizedName}.gpx`))
      ).toBe(true);
    }

    // Check the traces.json file
    expect(fs.existsSync(tracesFilePath)).toBe(true);
    const tracesJson = JSON.parse(fs.readFileSync(tracesFilePath, 'utf8'));
    expectTestTraces(tracesJson.traces);
  });
});
