import L from 'leaflet';
import xml2js from 'xml2js';

document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map').setView([51.505, -0.09], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  fetch('data/traces.json')
    .then(response => response.json())
    .then(data => {
      const traces = data.traces;
      const traceLayers = {};

      traces.forEach(trace => {
        const coordinates = trace.coordinates.map(coord => [coord.lat, coord.lon]);
        const polyline = L.polyline(coordinates, { color: getColor(trace.category) }).addTo(map);

        polyline.on('click', () => {
          const link = document.createElement('a');
          link.href = `gpx-files/${trace.name}.gpx`;
          link.download = `${trace.name}.gpx`;
          link.click();
        });

        if (!traceLayers[trace.category]) {
          traceLayers[trace.category] = [];
        }
        traceLayers[trace.category].push(polyline);
      });

      const checkboxes = document.querySelectorAll('input[name="category"]');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          const category = checkbox.value;
          if (checkbox.checked) {
            traceLayers[category].forEach(layer => map.addLayer(layer));
          } else {
            traceLayers[category].forEach(layer => map.removeLayer(layer));
          }
        });
      });
    });

  function getColor(category) {
    switch (category) {
      case 'sec':
        return 'blue';
      case 'humide':
        return 'green';
      case 'boueux':
        return 'brown';
      default:
        return 'gray';
    }
  }
});
