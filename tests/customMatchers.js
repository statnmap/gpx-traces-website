/**
 * Custom matcher to check if two sets of coordinates are close to each other within a specified precision, so that we can compare even after coordinates simplification.
 *
 * @function
 * @param {Array<{lat: number, lon: number}>} received - The received array of coordinates to be tested.
 * @param {Array<{lat: number, lon: number}>} expected - The expected array of coordinates to compare against.
 * @param {number} [precision=3] - The number of decimal places to consider for the comparison. 3 digits for geographic coordinates is a good default, when geographic simplification is 10 meters.
 * @returns {Object} An object containing a message function and a pass boolean indicating if the test passed.
 */
function toBeCloseToCoordinates(received, expected, precision = 3) {
  const pass = received.every((coord, index) => {
    return (
      Math.abs(coord.lat - expected[index].lat) < Math.pow(10, -precision) &&
      Math.abs(coord.lon - expected[index].lon) < Math.pow(10, -precision)
    );
  });

  if (pass) {
    return {
      message: () =>
        `expected ${received} not to be close to ${expected} with precision of ${precision} digits`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected ${received} to be close to ${expected} with precision of ${precision} digits`,
      pass: false,
    };
  }
}

module.exports = {
  toBeCloseToCoordinates,
};
