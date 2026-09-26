const { processGpxFiles } = require('./process-gpx');

const gpxFilesDir = process.env.GPX_FILES_DIR || 'gpx-files-real-data';
const tracesFilePath =
  process.env.TRACES_FILE_PATH || 'traces-real/traces.json';

processGpxFiles(gpxFilesDir, tracesFilePath).catch((err) => {
  console.error('Error processing GPX files:', err);
  process.exit(1);
});
