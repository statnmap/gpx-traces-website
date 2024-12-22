const fs = require('fs');
const path = require('path');
const diacritics = require('diacritics'); // Import the diacritics library

const gpxDir = path.join(__dirname, '../gpx-files');

function sanitizeGpxFileNames() {
  fs.readdir(gpxDir, (err, files) => {
    if (err) {
      console.error('Error reading GPX directory:', err);
      process.exit(1);
    }

    files.forEach((file) => {
      if (path.extname(file) === '.gpx') {
        const sanitizedFileName = sanitizeFileName(path.basename(file, '.gpx')) + '.gpx';
        const oldFilePath = path.join(gpxDir, file);
        const newFilePath = path.join(gpxDir, sanitizedFileName);

        if (oldFilePath !== newFilePath) {
          fs.rename(oldFilePath, newFilePath, (err) => {
            if (err) {
              console.error('Error renaming file:', err);
              process.exit(1);
            } else {
              console.log(`Renamed ${file} to ${sanitizedFileName}`);
            }
          });
        }
      }
    });
  });
}

function sanitizeFileName(fileName) {
  return diacritics.remove(fileName) // Use diacritics library to remove accents
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
}

module.exports = { sanitizeGpxFileNames, sanitizeFileName };
