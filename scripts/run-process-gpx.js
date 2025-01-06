const { processGpxFiles } = require('./process-gpx');

const gpxFilesDir = process.env.GPX_FILES_DIR || 'gpx-files-real-data';

processGpxFiles(gpxFilesDir).catch(err => {
  console.error('Error processing GPX files:', err);
  process.exit(1);
});
