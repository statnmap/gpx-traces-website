const diacritics = require('diacritics'); // Import the diacritics library

function sanitizeFileName(fileName) {
  return diacritics
    .remove(fileName) // Use diacritics library to remove accents
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
}

module.exports = { sanitizeFileName };
