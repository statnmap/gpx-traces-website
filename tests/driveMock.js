const fs = require('fs');
const path = require('path');
const { setDriveClient } = require('../scripts/process-gpx');

const mockFilesDir = path.join(__dirname, '../test-gpx-files');

/**
 * Creates a fake Google Drive client serving the files of test-gpx-files/,
 * which mirror the Google Drive test folder (see driveTestData.js).
 * @returns {Object} A client with the `files.list` and `files.get` methods used by process-gpx.
 */
function createDriveMock() {
  return {
    files: {
      list: async () => ({
        data: {
          files: fs
            .readdirSync(mockFilesDir)
            .filter((name) => name.endsWith('.gpx'))
            .map((name) => ({ id: name, name })),
        },
      }),
      get: async ({ fileId }) => ({
        data: fs.createReadStream(path.join(mockFilesDir, fileId)),
      }),
    },
  };
}

/**
 * Uses the Drive mock, unless DRIVE_LIVE=true (monthly integration run) in
 * which case the real Google Drive API is called.
 * Call it from a `beforeAll`.
 */
function useDriveForTests() {
  if (process.env.DRIVE_LIVE === 'true') {
    setDriveClient(undefined);
  } else {
    setDriveClient(createDriveMock());
  }
}

module.exports = { createDriveMock, useDriveForTests };
