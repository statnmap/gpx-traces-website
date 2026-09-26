/**
 * UI smoke test of the built website (dist/), run in a headless browser.
 *
 * Usage: npm run build && npm run test:ui
 *
 * Checks that the map loads, that every trace of traces.json is drawn, that
 * popups, GPX downloads, category and distance filters and the GPS button
 * work, and that
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

/**
 * Expected distance class of a parcours, written independently from
 * scripts/map-utils.js: < 8 km, 8 to < 10 km, >= 10 km, or unknown.
 * @param {number|null} distanceKm - The distance read from the trace name.
 * @returns {string} The value of the matching distance checkbox.
 */
function expectedDistanceClass(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return 'unknown';
  if (distanceKm < 8) return 'lt8';
  if (distanceKm < 10) return '8to10';
  return 'gte10';
}

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

/**
 * Finds a point of a trace that is visible in the map, and returns the page
 * coordinates of that point with the index of the trace drawn on top there.
 * @param {import('playwright').Page} page - The page showing the map.
 * @returns {Promise<{index: number, x: number, y: number} | null>}
 */
function findTracePoint(page) {
  return page.evaluate(() => {
    const map = document.getElementById('mapcontent').getBoundingClientRect();
    const paths = document.querySelectorAll(
      '#mapcontent path.leaflet-interactive'
    );
    for (let index = 0; index < paths.length; index++) {
      const path = paths[index];
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const m = path.getScreenCTM();
      const x = p.x * m.a + p.y * m.c + m.e;
      const y = p.x * m.b + p.y * m.d + m.f;
      if (
        x > map.left + 20 &&
        x < map.right - 20 &&
        y > map.top + 20 &&
        y < map.bottom - 20
      ) {
        // Traces can overlap: keep the one actually under the point
        const hit = [...paths].indexOf(document.elementFromPoint(x, y));
        if (hit >= 0) {
          return { index: hit, x, y };
        }
      }
    }
    return null;
  });
}

/**
 * Records errors of the website itself: map tiles come from openstreetmap.org
 * and may be unavailable from CI.
 * @param {import('playwright').Page} page - The page to watch.
 * @param {string} baseUrl - The URL of the local website.
 * @param {string[]} errors - The list where errors are pushed.
 */
function watchErrors(page, baseUrl, errors) {
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

    const errors = [];
    watchErrors(page, baseUrl, errors);

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

    // Mouse: hover and click on a trace
    const point = await findTracePoint(page);
    check(Boolean(point), 'A trace is visible in the map');
    const trace = tracePaths.nth(point ? point.index : 0);
    const traceColor = await trace.getAttribute('stroke');
    await page.mouse.move(point.x, point.y);
    check(
      (await page.locator('.leaflet-tooltip').count()) > 0 &&
        (await trace.getAttribute('stroke')) === 'red',
      'Hover shows a tooltip and highlights the trace'
    );
    await page.mouse.click(point.x, point.y);
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
    await page.mouse.move(5, 5);
    check(
      (await trace.getAttribute('stroke')) === 'red',
      'Trace stays highlighted while its popup is open'
    );
    await page.locator('.leaflet-popup-close-button').click();
    check(
      (await trace.getAttribute('stroke')) === traceColor,
      'Trace color is restored when its popup closes'
    );

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

    // Distance filters: only for parcours
    const parcours = traces.filter((t) => t.category === 'parcours');
    const hasUnknown = parcours.some(
      (t) => expectedDistanceClass(t.distanceKm) === 'unknown'
    );
    check(
      (await page.locator('#distance-unknown').isVisible()) === hasUnknown,
      `"Distance inconnue" filter is ${hasUnknown ? 'shown' : 'hidden'}`
    );
    for (const distanceClass of ['lt8', '8to10', 'gte10', 'unknown']) {
      const checkbox = page.locator(
        `input[name="distance"][value="${distanceClass}"]`
      );
      if (!(await checkbox.isVisible())) continue;
      const expected = parcours.filter(
        (t) => expectedDistanceClass(t.distanceKm) === distanceClass
      ).length;
      await checkbox.uncheck();
      const hidden = traces.length - (await tracePaths.count());
      await checkbox.check();
      const shown = await tracePaths.count();
      check(
        hidden === expected && shown === traces.length,
        `Distance filter "${distanceClass}" hides ${expected} parcours and restores them`
      );
    }

    // Unchecking all distances hides every parcours, and nothing else
    for (const checkbox of await page
      .locator('input[name="distance"]:visible')
      .all()) {
      await checkbox.uncheck();
    }
    check(
      (await tracePaths.count()) === traces.length - parcours.length,
      `Unchecking all distances hides the ${parcours.length} parcours only`
    );
    for (const checkbox of await page
      .locator('input[name="distance"]:visible')
      .all()) {
      await checkbox.check();
    }

    // Distance filters are greyed out when parcours are hidden
    await page.locator('input[name="category"][value="parcours"]').uncheck();
    check(
      await page.locator('#distance-filters.disabled').isVisible(),
      'Distance filters are disabled when parcours are hidden'
    );
    await page.locator('input[name="category"][value="parcours"]').check();

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

    // Touch screen: tap on a trace
    const touchContext = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const touchPage = await touchContext.newPage();
    await touchPage.coverage.startJSCoverage({ resetOnNavigation: false });
    watchErrors(touchPage, baseUrl, errors);
    await touchPage.goto(baseUrl, { waitUntil: 'networkidle' });
    const touchPaths = touchPage.locator(
      '#mapcontent path.leaflet-interactive'
    );
    await touchPaths
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => {});
    const touchPoint = await findTracePoint(touchPage);
    check(Boolean(touchPoint), 'A trace is visible in the map (touch)');
    const touchTrace = touchPaths.nth(touchPoint ? touchPoint.index : 0);
    const touchColor = await touchTrace.getAttribute('stroke');
    await touchPage.touchscreen.tap(touchPoint.x, touchPoint.y);
    check(
      (await touchPage.locator('.leaflet-popup').count()) === 1 &&
        (await touchTrace.getAttribute('stroke')) === 'red',
      'Tap opens the popup and highlights the trace'
    );
    check(
      (await touchPage.locator('.leaflet-tooltip').count()) === 0,
      'No hover tooltip on touch screens'
    );
    await touchPage.locator('.leaflet-popup-close-button').tap();
    check(
      (await touchTrace.getAttribute('stroke')) === touchColor,
      'Trace color is restored when its popup closes (touch)'
    );

    check(
      errors.length === 0,
      `No page error${errors.length ? `:\n    ${errors.join('\n    ')}` : ''}`
    );

    await writeCoverage([
      ...(await page.coverage.stopJSCoverage()),
      ...(await touchPage.coverage.stopJSCoverage()),
    ]);
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
