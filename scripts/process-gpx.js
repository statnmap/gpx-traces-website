const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { google } = require('googleapis');
const { sanitizeFileName } = require('./sanitize-gpx');

const outputFilePath = path.join(__dirname, '../data/traces.json');

const categories = ['parcours', 'chemin_boueux', 'chemin_inondable', 'danger'];

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../credentials.json'),
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});

const drive = google.drive({
  version: 'v3',
  auth: auth
});

async function listGpxFiles() {
  console.log('Starting listGpxFile function');
  const folderId = process.env.NODE_ENV === 'test' ? process.env.GOOGLE_DRIVE_FOLDER_ID_TEST : process.env.GOOGLE_DRIVE_FOLDER_ID;
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '.gpx'`,
    fields: 'files(id, name)'
  });
  console.log('All files found:', res.data.files);
  return res.data.files;
}

async function downloadGpxFile(fileId, fileName, gpxFilesDir) {
  console.log('Starting downloadGpxFile:', fileName);
  const res = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  }, { responseType: 'stream' });

  return new Promise((resolve, reject) => {
    let data = '';
    res.data.on('data', chunk => {
      data += chunk;
    });
    res.data.on('end', () => {
      const sanitizedFileName = sanitizeFileName(path.basename(fileName, '.gpx')) + '.gpx';
      const filePath = path.join(gpxFilesDir, sanitizedFileName);
      ensureGpxFilesDirectoryExists(gpxFilesDir);
      fs.writeFileSync(filePath, data);
      resolve(filePath);
    });
    res.data.on('error', err => {
      reject(err);
    });
  });
}

async function processGpxFiles(gpxFilesDir) {
  console.log('Starting processGpxFile function');
  const traces = [];
  const files = await listGpxFiles();

  // Clean content of gpx-files directory before downloading
  cleanGpxFilesDirectory(gpxFilesDir);

  // Delete the existing traces.json file if it exists
  if (fs.existsSync(outputFilePath)) {
    fs.unlinkSync(outputFilePath);
    console.log('Deleted existing traces.json file');
  }

  for (const file of files) {
    try {
      const filePath = await downloadGpxFile(file.id, file.name, gpxFilesDir);
      const gpxData = fs.readFileSync(filePath, 'utf8');
      const sanitizedFileName = sanitizeFileName(path.basename(file.name, '.gpx')) + '.gpx';

      xml2js.parseString(gpxData, (err, result) => {
        if (err) {
          console.error('Error parsing GPX file:', err);
          throw err;
        }

        const trace = {
          name: path.basename(file.name, '.gpx'),
          sanitizedName: sanitizeFileName(path.basename(file.name, '.gpx')),
          category: getCategory(sanitizeFileName(path.basename(file.name, '.gpx'))),
          coordinates: getCoordinates(result.gpx.trk[0].trkseg[0].trkpt)
        };

        traces.push(trace);
      });
    } catch (error) {
      console.error('Error processing file:', file.name, error);
      throw error;
    }
  }

  try {
    await writeTracesJson(traces);
  } catch (error) {
    console.error('Error writing traces.json:', error);
    throw error;
  }

  // Check if all trace files exist in the gpx-files directory
  const gpxFiles = fs.readdirSync(gpxFilesDir);
  console.log('GPX files in directory:', gpxFiles);

  traces.forEach(trace => {
    const filePath = path.join(gpxFilesDir, `${trace.sanitizedName}.gpx`);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
    }
  });
}

async function writeTracesJson(traces) {
  ensureDataDirectoryExists();
    if (process.env.NODE_ENV === 'test') {
      console.log('traces content before JSON', traces)
    }

  return new Promise((resolve, reject) => {
    fs.writeFile(outputFilePath, JSON.stringify({ traces }, null, 2), (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Successfully wrote traces.json file');
        resolve();
      }
    });
  });
}

function getCategory(sanitizedName) {
  if (sanitizedName.startsWith("parcours")) {
    return 'parcours';
  } else if (sanitizedName.includes("chemin") && sanitizedName.includes("boueux")) {
    return 'chemin_boueux';
  } else if (sanitizedName.includes("chemin") && sanitizedName.includes("inondable")) {
    return 'chemin_inondable';
  } else if (sanitizedName.includes("danger")) {
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

function getCoordinates(trkpts) {
  return trkpts.map((trkpt) => ({
    lat: parseFloat(trkpt.$.lat),
    lon: parseFloat(trkpt.$.lon)
  }));
}

function ensureDataDirectoryExists() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
}

function ensureGpxFilesDirectoryExists(gpxFilesDir) {
  if (!fs.existsSync(gpxFilesDir)) {
    fs.mkdirSync(gpxFilesDir);
  }
}

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
  getCoordinates
};
