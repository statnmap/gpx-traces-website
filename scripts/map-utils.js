/**
 * Returns the color associated with a given category.
 * @param {string} category - The category of the trace.
 * @returns {string} The color associated with the category.
 */
function getColor(category) {
  if (category === 'parcours') {
    return '#35978f';
  } else if (category === 'chemin_boueux') {
    return '#542788';
  } else if (category === 'chemin_inondable') {
    return '#fdb863';
  } else if (category === 'danger') {
    return '#b30000';
  } else {
    return 'pink';
  }
}

/**
 * Returns the weight associated with a given category.
 * @param {string} category - The category of the trace.
 * @returns {number} The weight associated with the category.
 */
function getWeight(category) {
  if (category === 'parcours') {
    return 8;
  } else if (category === 'chemin_boueux') {
    return 10;
  } else if (category === 'chemin_inondable') {
    return 10;
  } else if (category === 'danger') {
    return 11;
  } else {
    return 8;
  }
}

/**
 * Returns the distance class of a "parcours", used by the distance filters.
 * @param {number|null} distanceKm - The distance read from the trace name.
 * @returns {string} 'lt8' (< 8 km), '8to10' (8 to < 10 km), 'gte10' (>= 10 km)
 *   or 'unknown' when the name has no distance.
 */
function getDistanceClass(distanceKm) {
  if (typeof distanceKm !== 'number') {
    return 'unknown';
  } else if (distanceKm < 8) {
    return 'lt8';
  } else if (distanceKm < 10) {
    return '8to10';
  } else {
    return 'gte10';
  }
}

export { getColor, getWeight, getDistanceClass };
