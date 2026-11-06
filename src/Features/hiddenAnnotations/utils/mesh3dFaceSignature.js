// Geometric signature of a face of a mesh annotation (annotation.mesh3d,
// STORED form: x, y normalized against the base map image, z in meters above
// annotation.offsetZ — see mesh3dFrame).
//
// Face indices are renumbered by every mesh write, so a hidden face is
// remembered by its vertices instead: [xNorm, yNorm, offsetZ + z] (the
// absolute altitude: a write re-bases z on the lowest vertex and moves the
// shift into offsetZ). A face whose geometry changes (an edit, a move of the
// mesh) no longer matches: it is shown again.
//
// Pure (relative imports only): node-testable.

// Matching tolerances: normalized plan coordinates (0.1 mm on a 100 m wide
// base map) and meters.
const EPSILON_XY = 1e-6;
const EPSILON_Z = 1e-3;

function getFaceVertices(annotation, face) {
  const vertices = annotation?.mesh3d?.vertices;
  if (!vertices || !(face?.loop?.length >= 3)) return null;
  const offsetZ = Number(annotation.offsetZ) || 0;
  const result = [];
  for (const loop of [face.loop, ...(face.holes || [])]) {
    for (const index of loop) {
      const vertex = vertices[index];
      if (!vertex) return null;
      result.push([vertex[0], vertex[1], offsetZ + (vertex[2] || 0)]);
    }
  }
  return result;
}

// Readable, order-independent key of a vertex list: the identity of an entry
// in the registry (React key, removal). Matching never relies on it.
function getVerticesKey(vertices) {
  return vertices
    .map(([x, y, z]) => `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(3)}`)
    .sort()
    .join(";");
}

// { key, vertices } of face `faceIndex`, or null when the face does not
// exist.
export function getMesh3dFaceSignature(annotation, faceIndex) {
  const face = annotation?.mesh3d?.faces?.[faceIndex];
  const vertices = getFaceVertices(annotation, face);
  if (!vertices) return null;
  return { key: getVerticesKey(vertices), vertices };
}

function isSameVertex(a, b) {
  return (
    Math.abs(a[0] - b[0]) <= EPSILON_XY &&
    Math.abs(a[1] - b[1]) <= EPSILON_XY &&
    Math.abs(a[2] - b[2]) <= EPSILON_Z
  );
}

// Same vertices, whatever their order (a write may rotate / reverse a loop).
function matchesSignature(vertices, signature) {
  const candidates = signature?.vertices;
  if (!candidates || candidates.length !== vertices.length) return false;
  const used = new Array(candidates.length).fill(false);
  for (const vertex of vertices) {
    const index = candidates.findIndex(
      (candidate, i) => !used[i] && isSameVertex(vertex, candidate)
    );
    if (index < 0) return false;
    used[index] = true;
  }
  return true;
}

// True when `face` (a face of annotation.mesh3d) is one of the hidden
// `signatures`.
export function isMesh3dFaceHidden(annotation, face, signatures) {
  if (!signatures?.length) return false;
  const vertices = getFaceVertices(annotation, face);
  if (!vertices) return false;
  return signatures.some((signature) => matchesSignature(vertices, signature));
}

// Indices of the hidden faces of annotation.mesh3d, as a Set (empty when
// none).
export function getHiddenMesh3dFaceIndices(annotation, signatures) {
  const hidden = new Set();
  if (!signatures?.length) return hidden;
  (annotation?.mesh3d?.faces || []).forEach((face, faceIndex) => {
    if (isMesh3dFaceHidden(annotation, face, signatures)) hidden.add(faceIndex);
  });
  return hidden;
}
