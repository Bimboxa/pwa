// Module-level holder of the rendered cut lines (ThreedCutLineAnnotations
// publishes on every rebuild):
//   - the pickable Line2 segments (pickCutLine — the meshing / editor click
//     pre-passes, since the `.isMesh` annotation picks skip fat lines);
//   - per line, its vertices in world space (useCutLineVertexHandlers: grab
//     by screen distance, the markers never raycast);
//   - per line, the VISIBLE world polyline (stops applied) — the meshing
//     module clips the hovered faces with them (clipFaceByCutLines).
// `version` bumps on every publish: a cache key for the consumers.

let _entries = [];
let _lines = [];
let _version = 0;
const _listeners = new Set();

function notify() {
  _listeners.forEach((fn) => fn());
}

// entries: [{ annotationId, group, lines: Line2[], vertices: [{ pointId,
// index, world: Vector3, derived, stop, hidden }], worldPolyline: [{x,y,z}] }]
export function setCutLineObjects(entries) {
  _entries = entries ? [...entries] : [];
  _lines = _entries.flatMap((e) => e.lines || []);
  _version += 1;
  notify();
}

export function getCutLineObjects() {
  return _entries;
}

export function getCutLineEntry(annotationId) {
  return _entries.find((e) => e.annotationId === annotationId) || null;
}

// Every pickable segment (Line2 with the fat-line raycast).
export function getCutLineLines() {
  return _lines;
}

// [{ id, points: [{x, y, z}] }] — the visible run of every rendered line.
export function getCutLinesWorldPolylines() {
  return _entries
    .filter((e) => e.worldPolyline?.length >= 2)
    .map((e) => ({ id: e.annotationId, points: e.worldPolyline }));
}

export function getCutLinesVersion() {
  return _version;
}

export function subscribeCutLineObjects(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
