const { sanitizeGpxFileNames, sanitizeFileName } = require('../scripts/sanitize-gpx');

describe('sanitizeGpxFileNames', () => {
  test('sanitizes filenames by replacing non-alphanumeric characters with underscores and converting them to lowercase', () => {
    const filenames = [
      'Test File 1.gpx',
      'Another-File_2.gpx',
      'file@name#3.gpx'
    ];

    const expectedSanitizedFilenames = [
      'test_file_1.gpx',
      'another_file_2.gpx',
      'file_name_3.gpx'
    ];

    filenames.forEach((filename, index) => {
      const sanitizedFilename = sanitizeFileName(filename.replace('.gpx', '')) + '.gpx';
      expect(sanitizedFilename).toBe(expectedSanitizedFilenames[index]);
    });
  });

  test('sanitizes filenames by replacing accented characters with unaccented equivalents', () => {
    const filenames = [
      'éèàçôöîïùûüâäêëÿñ.gpx',
      'ÉÈÀÇÔÖÎÏÙÛÜÂÄÊËŸÑ.gpx'
    ];

    const expectedSanitizedFilenames = [
      'eeacooiiuuuaaeeyn.gpx',
      'eeacooiiuuuaaeeyn.gpx'
    ];

    filenames.forEach((filename, index) => {
      const sanitizedFilename = sanitizeFileName(filename.replace('.gpx', '')) + '.gpx';
      expect(sanitizedFilename).toBe(expectedSanitizedFilenames[index]);
    });
  });
});
