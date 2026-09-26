/**
 * Expected content of the Google Drive test folder (GOOGLE_DRIVE_FOLDER_ID_TEST),
 * after processing. Keep in sync with the files in test-gpx-files/.
 *
 * Traces are looked up by name: the order of files listed by Google Drive is
 * not guaranteed.
 */
const expectedTestTraces = [
  {
    name: 'Chemin boueux - 9km - La valinière',
    sanitizedName: 'chemin_boueux___9km___la_valiniere',
    category: 'chemin_boueux',
    // The distance of information traces is ignored
    distanceKm: null,
    coordinates: [
      { lat: 47.325, lon: -1.736 },
      { lat: 47.326, lon: -1.737 },
    ],
  },
  {
    name: 'Parcours - 10km - Cens - Bongarant',
    sanitizedName: 'parcours___10km___cens___bongarant',
    category: 'parcours',
    distanceKm: 10,
    // Long trace: only check where it starts
    firstCoordinate: { lat: 47.2784, lon: -1.6967 },
  },
  {
    name: 'Sample Track',
    sanitizedName: 'sample_track',
    category: 'autres',
    distanceKm: null,
    coordinates: [
      { lat: 47.325, lon: -1.736 },
      { lat: 47.326, lon: -1.737 },
    ],
  },
];

/**
 * Checks the traces produced from the Google Drive test folder.
 * Needs the `toBeCloseToCoordinates` matcher to be registered.
 * @param {Object[]} traces - The traces read from traces.json.
 */
function expectTestTraces(traces) {
  expect(traces).toHaveLength(expectedTestTraces.length);

  for (const expected of expectedTestTraces) {
    const trace = traces.find(
      (t) => t.sanitizedName === expected.sanitizedName
    );
    expect(trace).toBeDefined();
    expect(trace.name).toBe(expected.name);
    expect(trace.category).toBe(expected.category);
    expect(trace.distanceKm).toBe(expected.distanceKm);
    if (expected.coordinates) {
      expect(trace.coordinates).toBeCloseToCoordinates(expected.coordinates, 3);
    } else {
      expect(trace.coordinates.length).toBeGreaterThan(10);
      expect([trace.coordinates[0]]).toBeCloseToCoordinates(
        [expected.firstCoordinate],
        3
      );
    }
  }
}

module.exports = { expectedTestTraces, expectTestTraces };
