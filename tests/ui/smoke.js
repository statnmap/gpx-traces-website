/**
 * UI smoke test of the built website (dist/), run in a headless browser.
 *
 * Usage: npm run build && npm run test:ui
 *
 * Checks that the map loads, that every trace of traces.json is drawn, that
 * popups, GPX downloads, category filters and the GPS button work, and that
 * the page raises no JavaScript error. Exits with code 1 on any failure.
 *
 * JavaScript coverage of scripts/*.js is written to coverage-ui/lcov.info
 * (through the webpack source maps), to be uploaded to Codecov.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const MCR = require('monocart-coverage-reports');

const distDir = path.resolve(__dirname, '../../dist');
const tracesFilePath =
  process.env.TRACES_FILE_PATH || 'traces-real/traces.json';
const categories = [
  'parcours',
  'chemin_boueux',
  'chemin_inondable',
  'danger',
  'autres',
];

const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.gpx': 'application/gpx+xml',
};

/**
 * Serves the dist directory on a random local port.
 * @returns {Promise<http.Server>} The listening server.
 */
function serveDist() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let filePath = path.join(distDir, urlPath);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type':
          contentTypes[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(data);
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server))
  );
}

/**
 * Writes the coverage of the website scripts, mapped back to scripts/*.js.
 * @param {Object[]} coverage - V8 coverage entries from Playwright.
 */
async function writeCoverage(coverage) {
  const report = MCR({
    name: 'UI smoke test coverage',
    outputDir: path.resolve(__dirname, '../../coverage-ui'),
    reports: ['lcovonly', 'console-summary'],
    cleanCache: true,
    entryFilter: (entry) => entry.url.endsWith('/main.js'),
    sourceFilter: (sourcePath) => sourcePath.includes('scripts/'),
    sourcePath: (filePath) => filePath.replace(/^.*?scripts\//, 'scripts/'),
  });
  await report.add(coverage);
  await report.generate();
}

async function main() {
  const traces = JSON.parse(
    fs.readFileSync(path.join(distDir, tracesFilePath), 'utf8')
  ).traces;
  if (traces.length === 0) {
    throw new Error(`No trace in ${tracesFilePath}: nothing to test`);
  }

  const server = await serveDist();
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const failures = [];
  const check = (ok, message) => {
    console.log(`${ok ? '✔' : '✘'} ${message}`);
    if (!ok) failures.push(message);
  };

  try {
    const context = await browser.newContext({
      geolocation: { latitude: 47.33, longitude: -1.74 },
      permissions: ['geolocation'],
    });
    const page = await context.newPage();
    await page.coverage.startJSCoverage({ resetOnNavigation: false });

    // Only errors of the website itself count: map tiles come from
    // openstreetmap.org and may be unavailable from CI.
    const errors = [];
    page.on('pageerror', (e) => errors.push(`JS error: ${e.message}`));
    page.on('response', (r) => {
      const url = new URL(r.url());
      if (
        r.status() >= 400 &&
        url.origin === new URL(baseUrl).origin &&
        url.pathname !== '/favicon.ico'
      ) {
        errors.push(`HTTP ${r.status()}: ${url.pathname}`);
      }
    });
    page.on('dialog', (d) => {
      errors.push(`Unexpected dialog: ${d.message()}`);
      d.dismiss();
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    const tracePaths = page.locator('#mapcontent path.leaflet-interactive');
    await tracePaths
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => {});

    check(
      (await page.locator('#mapcontent.leaflet-container').count()) === 1,
      'Leaflet map is initialized'
    );
    const leafletCssLoaded = await page
      .locator('.leaflet-pane')
      .first()
      .evaluate((el) => getComputedStyle(el).position === 'absolute');
    check(leafletCssLoaded, 'Leaflet CSS is loaded');
    check(
      (await tracePaths.count()) === traces.length,
      `All traces are drawn (${await tracePaths.count()}/${traces.length})`
    );

    // Hover and click on a trace
    const firstTrace = tracePaths.first();
    await firstTrace.hover({ force: true });
    check(
      (await page.locator('.leaflet-tooltip').count()) > 0,
      'Tooltip shows on hover'
    );
    await firstTrace.click({ force: true });
    const downloadLink = page.locator('.leaflet-popup a[download]').first();
    const href = (await downloadLink.count())
      ? await downloadLink.getAttribute('href')
      : null;
    check(Boolean(href), 'Popup shows a GPX download link');
    if (href) {
      const response = await page.request.get(new URL(href, baseUrl).href);
      const body = await response.text();
      check(
        response.status() === 200 && body.includes('<gpx'),
        `GPX file is downloadable (${href})`
      );
    }
    await page.keyboard.press('Escape');

    // Category filters, including categories without any trace
    for (const category of categories) {
      const expected = traces.filter((t) => t.category === category).length;
      const checkbox = page.locator(
        `input[name="category"][value="${category}"]`
      );
      await checkbox.uncheck();
      const hidden = traces.length - (await tracePaths.count());
      await checkbox.check();
      const shown = await tracePaths.count();
      check(
        hidden === expected && shown === traces.length,
        `Filter "${category}" hides ${expected} trace(s) and restores them`
      );
    }

    // GPS position button
    const gpsButton = page.locator('#add-gps-position');
    await gpsButton.click();
    await page
      .locator('.leaflet-marker-icon')
      .first()
      .waitFor({ timeout: 5000 })
      .catch(() => {});
    const markerLoaded = await page
      .locator('.leaflet-marker-icon')
      .first()
      .evaluate((img) => img.complete && img.naturalWidth > 0)
      .catch(() => false);
    check(markerLoaded, 'GPS button shows the position marker');
    await gpsButton.click();
    check(
      (await page.locator('.leaflet-marker-icon').count()) === 0,
      'GPS button hides the position marker'
    );

    check(
      errors.length === 0,
      `No page error${errors.length ? `:\n    ${errors.join('\n    ')}` : ''}`
    );

    await writeCoverage(await page.coverage.stopJSCoverage());
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error(`\n${failures.length} UI check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll UI checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
