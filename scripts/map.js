import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { getColor, getWeight, getDistanceClass } from './map-utils';

/**
 * The path to the output dir where the processed gpx files were saved.
 * @type {string}
 */
const gpxFilesDir = process.env.GPX_FILES_DIR || 'gpx-files-real-data';
const tracesFilePath =
  process.env.TRACES_FILE_PATH || 'traces-real/traces.json';

// Leaflet guesses marker image paths from its CSS, which fails once bundled
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

let map = null;
let gpsMarker = null;

/**
 * Initializes the map and loads GPX traces from a given directory and file path.
 *
 * @param {string} gpxFilesDir - The directory where GPX files are stored.
 * @param {string} tracesFilePath - The path to the JSON file containing trace data.
 * @returns {L.Map} The initialized Leaflet map instance.
 *
 * @example
 * initializeMap('/path/to/gpx/files', '/path/to/traces.json');
 *
 * The JSON file should have the following structure:
 * {
 *   "traces": [
 *     {
 *       "name": "Trace Name",
 *       "sanitizedName": "trace-name",
 *       "category": "category-name",
 *       "coordinates": [
 *         { "lat": 47.325, "lon": -1.736 },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 * }
 */
function initializeMap(gpxFilesDir, tracesFilePath) {
  const map = L.map('mapcontent').setView([47.325, -1.736], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  fetch(tracesFilePath)
    .then((response) => response.json())
    .then((data) => {
      const traces = data.traces;
      const traceItems = [];
      const canHover = window.matchMedia('(hover: hover)').matches;
      const highlightStyle = { color: 'red', weight: 12 };

      traces.forEach((trace) => {
        const coordinates = trace.coordinates.map((coord) => [
          coord.lat,
          coord.lon,
        ]);
        const defaultStyle = {
          color: getColor(trace.category),
          weight: getWeight(trace.category),
        };
        const polyline = L.polyline(coordinates, defaultStyle).addTo(map);

        // Leaflet opens the popup where the trace is clicked or tapped.
        // The trace stays highlighted while its popup is open.
        polyline.bindPopup(`
          <div>
            <strong>${trace.name}</strong><br>
            <a href="${gpxFilesDir}/${trace.sanitizedName}.gpx" download>Download GPX</a>
          </div>
        `);
        polyline.on('popupopen', () => polyline.setStyle(highlightStyle));
        polyline.on('popupclose', () => polyline.setStyle(defaultStyle));

        // Hover effects only for devices with a real pointer: on touch screens
        // the browser emulates mouseover on tap, without a matching mouseout.
        if (canHover) {
          polyline.bindTooltip(`<strong>${trace.name}</strong>`, {
            sticky: true,
          });
          polyline.on('mouseover', () => polyline.setStyle(highlightStyle));
          polyline.on('mouseout', () => {
            if (!polyline.isPopupOpen()) {
              polyline.setStyle(defaultStyle);
            }
          });
        }

        traceItems.push({
          polyline,
          category: trace.category,
          // Distance filters only apply to "parcours"
          distanceClass:
            trace.category === 'parcours'
              ? getDistanceClass(trace.distanceKm)
              : null,
        });
      });

      // "Distance inconnue" is only offered when a parcours has no distance
      if (traceItems.some((item) => item.distanceClass === 'unknown')) {
        document.getElementById('distance-unknown').hidden = false;
      }

      document
        .querySelectorAll('input[name="category"], input[name="distance"]')
        .forEach((checkbox) => {
          checkbox.addEventListener('change', () =>
            updateVisibility(map, traceItems)
          );
        });
    });

  return map;
}

/**
 * Returns the values of the checked checkboxes of a filter.
 * @param {string} name - The name of the checkboxes ("category" or "distance").
 * @returns {Set<string>} The checked values.
 */
function getCheckedValues(name) {
  const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
  return new Set([...checked].map((checkbox) => checkbox.value));
}

/**
 * Shows the traces matching both the category and the distance filters.
 * @param {L.Map} map - The Leaflet map.
 * @param {Object[]} traceItems - The traces with their polyline, category and
 *   distance class (null when the distance filters do not apply).
 */
function updateVisibility(map, traceItems) {
  const categories = getCheckedValues('category');
  const distanceClasses = getCheckedValues('distance');
  traceItems.forEach(({ polyline, category, distanceClass }) => {
    const visible =
      categories.has(category) &&
      (distanceClass === null || distanceClasses.has(distanceClass));
    if (visible) {
      map.addLayer(polyline);
    } else {
      map.removeLayer(polyline);
    }
  });
  // Distance filters are useless when parcours are hidden
  document
    .getElementById('distance-filters')
    .classList.toggle('disabled', !categories.has('parcours'));
}

/**
 * Adds the current GPS position to the map.
 * @param {Object} position - The position object containing latitude and longitude.
 */
function addCurrentPositionToMap(position) {
  const { latitude, longitude } = position.coords;
  gpsMarker = L.marker([latitude, longitude]).addTo(map);
  gpsMarker.bindPopup('Vous êtes ici').openPopup();
}

/**
 * Removes the current GPS position marker from the map.
 */
function removeCurrentPositionFromMap() {
  if (gpsMarker) {
    map.removeLayer(gpsMarker);
    gpsMarker = null;
  }
}

/**
 * Handles errors when getting the current position.
 * @param {Object} error - The error object.
 */
function handleError(error) {
  console.error('Error getting current position:', error);
}

document.addEventListener('DOMContentLoaded', () => {
  map = initializeMap(gpxFilesDir, tracesFilePath);

  document
    .getElementById('add-gps-position')
    .addEventListener('click', (event) => {
      if (gpsMarker) {
        removeCurrentPositionFromMap();
        event.target.textContent = 'Afficher ma position GPS';
      } else {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            addCurrentPositionToMap(position);
            event.target.textContent = 'Masquer ma position GPS';
          }, handleError);
        } else {
          alert('Geolocation is not supported by this browser.');
        }
      }
    });
});
