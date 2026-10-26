import { BufferAttribute, BufferGeometry } from "three";

// Removes the T-junctions of a triangle mesh: vertices that lie on an edge of
// a triangle without being one of its endpoints.
//
// earcut (behind ShapeGeometry / ExtrudeGeometry / ShapeUtils.triangulateShape)
// leaves them behind on polygons with holes whose borders are collinear: it
// bridges each hole to the polygon from its lowest-left corner, then drops the
// exactly collinear vertices, so on ONE side of the slit the aligned hole
// edges and the bridges merge into a single long edge while the other side
// keeps the short pieces. Every reader that counts the triangles sharing an
// edge then takes those inner pieces for borders: EdgesGeometry draws a line
// joining the holes, getPlanarMeshBoundary returns the holes as one loop and
// the hatch band of applyHatchFill becomes a strip between them.
//
// Each triangle with such a vertex on one of its edges is split into a fan
// along that edge. The new vertices COPY the position of the vertex they stand
// for (position-welding readers then merge them) and interpolate the other
// attributes. The result keeps the input's indexing (indexed / soup) and
// groups. Returns the same geometry when it has no T-junction.

const MAX_TRIANGLES = 50000;
const MAX_DEPTH = 6;

export default function splitTJunctions(geometry, { tolerance = 1e-4 } = {}) {
  const position = geometry?.getAttribute?.("position");
  if (!position || position.count < 3) return geometry;
  const attributes = Object.entries(geometry.attributes);
  if (attributes.some(([, a]) => a.isInterleavedBufferAttribute)) {
    return geometry;
  }
  const index = geometry.getIndex();
  const cornerCount = index ? index.count : position.count;
  const triangleCount = Math.floor(cornerCount / 3);
  if (triangleCount < 1 || triangleCount > MAX_TRIANGLES) return geometry;
  const cornerVertex = (i) => (index ? index.getX(i) : i);
  const originalCount = position.count;

  // Candidate points = unique positions, sorted by x for the range search.
  const candidateIds = new Map();
  const candidates = [];
  const vertexCandidate = [];
  for (let i = 0; i < originalCount; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const key = `${Math.round(x / tolerance)}_${Math.round(
      y / tolerance
    )}_${Math.round(z / tolerance)}`;
    let id = candidateIds.get(key);
    if (id === undefined) {
      id = candidates.length;
      candidates.push([x, y, z]);
      candidateIds.set(key, id);
    }
    vertexCandidate[i] = id;
  }
  const byX = candidates
    .map((_, id) => id)
    .sort((p, q) => candidates[p][0] - candidates[q][0]);
  const sortedX = byX.map((id) => candidates[id][0]);
  const lowerBound = (value) => {
    let lo = 0;
    let hi = sortedX.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedX[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // Vertices appended by the splits: { candidate, from, to, t } (from / to are
  // vertex ids, possibly appended ones).
  const appended = [];
  const appendedIds = new Map();
  const getPosition = (i) =>
    i < originalCount
      ? [position.getX(i), position.getY(i), position.getZ(i)]
      : candidates[appended[i - originalCount].candidate];

  // Candidates strictly inside the segment [a, b], sorted along it.
  const pointsOnEdge = (a, b) => {
    const [ax, ay, az] = getPosition(a);
    const [bx, by, bz] = getPosition(b);
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const lengthSq = dx * dx + dy * dy + dz * dz;
    const length = Math.sqrt(lengthSq);
    if (length <= 2 * tolerance) return [];
    const ca = vertexCandidate[a];
    const cb = vertexCandidate[b];
    const minX = Math.min(ax, bx) - tolerance;
    const maxX = Math.max(ax, bx) + tolerance;
    const found = [];
    for (let i = lowerBound(minX); i < sortedX.length; i++) {
      if (sortedX[i] > maxX) break;
      const id = byX[i];
      if (id === ca || id === cb) continue;
      const [px, py, pz] = candidates[id];
      const t = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / lengthSq;
      if (t * length <= tolerance || (1 - t) * length <= tolerance) continue;
      const ex = px - (ax + dx * t);
      const ey = py - (ay + dy * t);
      const ez = pz - (az + dz * t);
      if (ex * ex + ey * ey + ez * ez > tolerance * tolerance) continue;
      found.push({ id, t });
    }
    found.sort((p, q) => p.t - q.t);
    return found;
  };

  const vertexFor = (from, to, point) => {
    const key =
      from < to ? `${from}_${to}_${point.id}` : `${to}_${from}_${point.id}`;
    let id = appendedIds.get(key);
    if (id === undefined) {
      id = originalCount + appended.length;
      appended.push({ candidate: point.id, from, to, t: point.t });
      vertexCandidate[id] = point.id;
      appendedIds.set(key, id);
    }
    return id;
  };

  // Output corners, by triangle, in the input order (groups stay contiguous).
  const out = [];
  let changed = false;
  const emit = (a, b, c, depth) => {
    if (depth < MAX_DEPTH) {
      const corners = [a, b, c];
      for (let k = 0; k < 3; k++) {
        const u = corners[k];
        const v = corners[(k + 1) % 3];
        const w = corners[(k + 2) % 3];
        const cw = vertexCandidate[w];
        const points = pointsOnEdge(u, v).filter((p) => p.id !== cw);
        if (!points.length) continue;
        changed = true;
        let prev = u;
        for (const point of points) {
          const q = vertexFor(u, v, point);
          emit(prev, q, w, depth + 1);
          prev = q;
        }
        emit(prev, v, w, depth + 1);
        return;
      }
    }
    out.push(a, b, c);
  };

  const triangleOutStart = [];
  for (let t = 0; t < triangleCount; t++) {
    triangleOutStart.push(out.length);
    emit(
      cornerVertex(3 * t),
      cornerVertex(3 * t + 1),
      cornerVertex(3 * t + 2),
      0
    );
  }
  if (!changed) return geometry;

  // Attribute value of any vertex: original, or interpolated along the split
  // edge (position: the candidate's own coordinates).
  const valueOf = (attribute, isPosition, i, k) => {
    if (i < originalCount) return attribute.array[i * attribute.itemSize + k];
    const extra = appended[i - originalCount];
    if (isPosition) return candidates[extra.candidate][k];
    const a = valueOf(attribute, isPosition, extra.from, k);
    const b = valueOf(attribute, isPosition, extra.to, k);
    return a + (b - a) * extra.t;
  };

  const result = new BufferGeometry();
  const totalVertices = originalCount + appended.length;
  for (const [name, attribute] of attributes) {
    const { itemSize } = attribute;
    const isPosition = name === "position";
    const count = index ? totalVertices : out.length;
    const array = new attribute.array.constructor(count * itemSize);
    for (let i = 0; i < count; i++) {
      const vertex = index ? i : out[i];
      for (let k = 0; k < itemSize; k++) {
        array[i * itemSize + k] = valueOf(attribute, isPosition, vertex, k);
      }
    }
    result.setAttribute(
      name,
      new BufferAttribute(array, itemSize, attribute.normalized)
    );
  }
  if (index) result.setIndex(out);

  // Groups (ExtrudeGeometry: caps / sides) remapped onto the output corners
  // when they tile the input in order; dropped otherwise.
  const groups = geometry.groups || [];
  let cursor = 0;
  const tiled = groups.every((g) => {
    const ok = g.start === cursor && g.count % 3 === 0;
    cursor += g.count;
    return ok;
  });
  if (groups.length && tiled && cursor === cornerCount) {
    for (const g of groups) {
      const firstTriangle = g.start / 3;
      const endTriangle = firstTriangle + g.count / 3;
      const start = triangleOutStart[firstTriangle];
      const end =
        endTriangle < triangleCount
          ? triangleOutStart[endTriangle]
          : out.length;
      result.addGroup(start, end - start, g.materialIndex);
    }
  }
  return result;
}
