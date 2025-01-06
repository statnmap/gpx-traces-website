const { processGpxFiles } = require('./process-gpx');

const gpxFilesDir = 'gpx-files-real-data';

processGpxFiles(gpxFilesDir).catch(err => {
  console.error('Error processing GPX files:', err);
  process.exit(1);
});
