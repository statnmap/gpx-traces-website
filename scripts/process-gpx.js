const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { google } = require('googleapis');
const { sanitizeFileName } = require('./sanitize-gpx');
const turf = require('@turf/turf');
const proj4 = require('proj4');

/**
 * The list of categories for the GPX traces.
 * @type {string[]}
 */
const categories = ['parcours', 'chemin_boueux', 'chemin_inondable', 'danger'];

/**
 * The Google Auth object for authentication with Google Drive.
 * @type {google.auth.GoogleAuth}
 */
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../credentials.json'),
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

/**
 * The Google Drive object for interacting with the Google Drive API.
 * @type {google.drive}
 */
const drive = google.drive({
  version: 'v3',
  auth: auth,
});

/**
 * Lists the GPX files in the specified Google Drive folder.
 * @returns {Promise<Object[]>} A promise that resolves to an array of file objects.
 */
async function listGpxFiles() {
  console.log('Starting listGpxFile function');
  const folderId =
    process.env.NODE_ENV === 'test'
      ? process.env.GOOGLE_DRIVE_FOLDER_ID_TEST
      : process.env.GOOGLE_DRIVE_FOLDER_ID;
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '.gpx'`,
    fields: 'files(id, name)',
  });
  console.log('All files found:', res.data.files);
  return res.data.files;
}

/**
 * Downloads a GPX file from Google Drive and saves it to the specified directory.
 * @param {string} fileId - The ID of the file to download.
 * @param {string} fileName - The name of the file to download.
 * @param {string} gpxFilesDir - The directory to save the downloaded file.
 * @returns {Promise<string>} A promise that resolves to the path of the downloaded file.
 */
async function downloadGpxFile(fileId, fileName, gpxFilesDir) {
  console.log('Starting downloadGpxFile:', fileName);
  const res = await drive.files.get(
    {
      fileId: fileId,
      alt: 'media',
    },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    let data = '';
    res.data.on('data', (chunk) => {
      data += chunk;
    });
    res.data.on('end', () => {
      const sanitizedFileName =
        sanitizeFileName(path.basename(fileName, '.gpx')) + '.gpx';
      const filePath = path.join(gpxFilesDir, sanitizedFileName);
      ensureGpxFilesDirectoryExists(gpxFilesDir);
      fs.writeFileSync(filePath, data);
      resolve(filePath);
    });
    res.data.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Processes the GPX files in the specified directory and generates a JSON file with the trace data.
 * @param {string} gpxFilesDir - The directory containing the GPX files to process.
 * @param {string} tracesFilePath - The path to the output file where the processed traces will be saved.
 * @returns {Promise<void>} A promise that resolves when the processing is complete.
 */
async function processGpxFiles(gpxFilesDir, tracesFilePath) {
  console.log('Starting processGpxFile function');
  const traces = [];
  const files = await listGpxFiles();

  // Clean content of gpx-files directory before downloading
  cleanGpxFilesDirectory(gpxFilesDir);

  // Delete the existing traces.json file if it exists
  if (fs.existsSync(tracesFilePath)) {
    fs.unlinkSync(tracesFilePath);
    console.log('Deleted existing traces.json file');
  }

  for (const file of files) {
    try {
      const filePath = await downloadGpxFile(file.id, file.name, gpxFilesDir);
      const gpxData = fs.readFileSync(filePath, 'utf8');

      xml2js.parseString(gpxData, (err, result) => {
        if (err) {
          console.error('Error parsing GPX file:', err);
          throw err;
        }

        const trace = {
          name: path.basename(file.name, '.gpx'),
          sanitizedName: sanitizeFileName(path.basename(file.name, '.gpx')),
          category: getCategory(
            sanitizeFileName(path.basename(file.name, '.gpx'))
          ),
          coordinates: getCoordinates(result.gpx.trk[0].trkseg[0].trkpt),
        };

        traces.push(trace);
      });
    } catch (error) {
      console.error('Error processing file:', file.name, error);
      throw error;
    }
  }

  try {
    await writeTracesJson(traces, tracesFilePath);
  } catch (error) {
    console.error('Error writing traces.json:', error);
    throw error;
  }

  // Check if all trace files exist in the gpx-files directory
  const gpxFiles = fs.readdirSync(gpxFilesDir);
  console.log('GPX files in directory:', gpxFiles);

  traces.forEach((trace) => {
    const filePath = path.join(gpxFilesDir, `${trace.sanitizedName}.gpx`);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
    }
  });
}

/**
 * Writes the processed trace data to a JSON file.
 * @param {Object[]} traces - The array of trace objects to write.
 * @param {string} tracesFilePath - The path to the output file where the processed traces will be saved.
 * @returns {Promise<void>} A promise that resolves when the writing is complete.
 */
async function writeTracesJson(traces, tracesFilePath) {
  ensureDataDirectoryExists(tracesFilePath);
  if (process.env.NODE_ENV === 'test') {
    console.log('traces content before JSON', traces);
  }

  return new Promise((resolve, reject) => {
    fs.writeFile(tracesFilePath, JSON.stringify({ traces }, null, 2), (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Successfully wrote traces.json file');
        resolve();
      }
    });
  });
}

/**
 * Determines the category of a trace based on its sanitized name.
 * @param {string} sanitizedName - The sanitized name of the trace.
 * @returns {string} The category of the trace.
 */
function getCategory(sanitizedName) {
  if (sanitizedName.startsWith('parcours')) {
    return 'parcours';
  } else if (
    sanitizedName.includes('chemin') &&
    sanitizedName.includes('boueux')
  ) {
    return 'chemin_boueux';
  } else if (
    sanitizedName.includes('chemin') &&
    sanitizedName.includes('inondable')
  ) {
    return 'chemin_inondable';
  } else if (sanitizedName.includes('danger')) {
    return 'danger';
  } else {
    for (const category of categories) {
      if (sanitizedName.toLowerCase().includes(category)) {
        return category;
      }
    }
  }
  return 'autres';
}

/**
 * Extracts the coordinates from the track points in a GPX file.
 * @param {Object[]} trkpts - The array of track point objects.
 * @returns {Object[]} The array of coordinate objects.
 */
function getCoordinates(trkpts) {
  const coordinates = trkpts.map((trkpt) => ({
    lat: parseFloat(trkpt.$.lat),
    lon: parseFloat(trkpt.$.lon),
  }));
  return simplifyCoordinates(coordinates);
}

/**
 * Simplifies the coordinates by keeping one point every 10 meters using Turf.js.
 * @param {Object[]} coordinates - The array of coordinate objects.
 * @returns {Object[]} The simplified array of coordinate objects.
 */
function simplifyCoordinates(coordinates) {
  // Define the Lambert-93 projection
  const proj =
    '+proj=lcc +lat_1=44 +lat_2=49 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +datum=RGF93 +units=m +no_defs';

  // Convert geographic coordinates to projected coordinates
  const projectedCoordinates = coordinates.map((coord) =>
    proj4(proj, [coord.lon, coord.lat])
  );

  // Create a line string with projected coordinates
  const line = turf.lineString(projectedCoordinates);

  // Simplify the line with a tolerance of 10 meters
  const simplified = turf.simplify(line, { tolerance: 10, highQuality: true });

  // Convert simplified coordinates back to geographic coordinates
  const simplifiedGeographic = simplified.geometry.coordinates.map((coord) =>
    proj4(proj, 'WGS84', coord)
  );

  // Return the simplified coordinates in geographic format
  return simplifiedGeographic.map((coord) => ({
    lat: coord[1],
    lon: coord[0],
  }));
}

/**
 * Ensures that the data directory exists, creating it if necessary.
 * @param {string} tracesFilePath - The path to the output file where the processed traces will be saved.
 */
function ensureDataDirectoryExists(tracesFilePath) {
  const dataDir = path.dirname(tracesFilePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
}

/**
 * Ensures that the GPX files directory exists, creating it if necessary.
 * @param {string} gpxFilesDir - The directory to check and create if necessary.
 */
function ensureGpxFilesDirectoryExists(gpxFilesDir) {
  if (!fs.existsSync(gpxFilesDir)) {
    fs.mkdirSync(gpxFilesDir);
  }
}

/**
 * Cleans the GPX files directory by deleting all files in it.
 * @param {string} gpxFilesDir - The directory to clean.
 */
function cleanGpxFilesDirectory(gpxFilesDir) {
  if (fs.existsSync(gpxFilesDir)) {
    fs.readdirSync(gpxFilesDir).forEach((file) => {
      const filePath = path.join(gpxFilesDir, file);
      fs.unlinkSync(filePath);
    });
  }
}

module.exports = {
  processGpxFiles,
  getCategory,
  getCoordinates,
  simplifyCoordinates,
};
