// Clip of one geometry chunk of a scan to a zone of interest (the polygon
// the user drew on the projection when the scan base map was created).
//
// A triangle is kept when its centroid lies inside the polygon (scan frame,
// XY, metres); the kept vertices are compacted (a chunk holds at most
// 65 535 vertices, so the Uint16 index stays valid) and the normalized
// bounds are recomputed. Positions stay quantized on the ORIGINAL scan bbox:
// the clip never changes the quantization grid.
//
// Pure module (no DOM, no three.js): runs in the import worker and in the
// node tests.

const QUANT_MAX = 65535;

// Even-odd rule. polygon: [[x, y], …] (closed implicitly).
export function pointInPolygon(x, y, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// chunk: {positions: Uint16Array (xyz normalized on bbox), uvs: Uint16Array |
// Float32Array | null, index: Uint16Array | Uint32Array}
// bbox: {min: [x, y, z], max: [x, y, z]} (metres, scan frame — the
// quantization grid); polygon: [[x, y], …] (metres, scan frame).
// → {positions, uvs, index, boundsMin, boundsMax, vertexCount,
//    triangleCount, zMin, zMax (metres)} | null when nothing is kept
export default function clipScene3dChunk(chunk, bbox, polygon) {
  const { positions, uvs, index } = chunk;
  if (!positions || !index || !polygon || polygon.length < 3) return null;

  const extentX = bbox.max[0] - bbox.min[0];
  const extentY = bbox.max[1] - bbox.min[1];
  const extentZ = bbox.max[2] - bbox.min[2];
  const toX = (q) => bbox.min[0] + (q / QUANT_MAX) * extentX;
  const toY = (q) => bbox.min[1] + (q / QUANT_MAX) * extentY;

  const triangleCount = Math.floor(index.length / 3);
  const keptTriangles = [];
  for (let t = 0; t < triangleCount; t++) {
    const a = index[t * 3] * 3;
    const b = index[t * 3 + 1] * 3;
    const c = index[t * 3 + 2] * 3;
    const cx = (toX(positions[a]) + toX(positions[b]) + toX(positions[c])) / 3;
    const cy =
      (toY(positions[a + 1]) + toY(positions[b + 1]) + toY(positions[c + 1])) /
      3;
    if (pointInPolygon(cx, cy, polygon)) keptTriangles.push(t);
  }
  if (keptTriangles.length === 0) return null;

  // vertex remap (old → new), in first-use order
  const vertexCountIn = positions.length / 3;
  const remap = new Int32Array(vertexCountIn).fill(-1);
  const newIndex = new Uint16Array(keptTriangles.length * 3);
  let vertexCount = 0;
  for (let k = 0; k < keptTriangles.length; k++) {
    const t = keptTriangles[k];
    for (let corner = 0; corner < 3; corner++) {
      const old = index[t * 3 + corner];
      if (remap[old] === -1) remap[old] = vertexCount++;
      newIndex[k * 3 + corner] = remap[old];
    }
  }

  const newPositions = new Uint16Array(vertexCount * 3);
  const uvStride = uvs ? 2 : 0;
  const newUvs = uvs ? new uvs.constructor(vertexCount * 2) : null;
  const boundsMin = [1, 1, 1];
  const boundsMax = [0, 0, 0];
  for (let old = 0; old < vertexCountIn; old++) {
    const next = remap[old];
    if (next === -1) continue;
    for (let axis = 0; axis < 3; axis++) {
      const q = positions[old * 3 + axis];
      newPositions[next * 3 + axis] = q;
      const value = q / QUANT_MAX;
      if (value < boundsMin[axis]) boundsMin[axis] = value;
      if (value > boundsMax[axis]) boundsMax[axis] = value;
    }
    if (newUvs) {
      newUvs[next * 2] = uvs[old * uvStride];
      newUvs[next * 2 + 1] = uvs[old * uvStride + 1];
    }
  }

  return {
    positions: newPositions,
    uvs: newUvs,
    index: newIndex,
    boundsMin,
    boundsMax,
    vertexCount,
    triangleCount: keptTriangles.length,
    zMin: bbox.min[2] + boundsMin[2] * extentZ,
    zMax: bbox.min[2] + boundsMax[2] * extentZ,
  };
}
