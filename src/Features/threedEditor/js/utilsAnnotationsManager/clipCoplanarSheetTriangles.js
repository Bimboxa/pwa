import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
  Vector3,
} from "three";
import polygonClipping from "polygon-clipping";

// Tolerance of the coplanarity tests on CSG operands (world frame, float32
// positions): relative to the magnitude of the coordinates, 1 µm floor.
export function coplanarTolerance(magnitude) {
  return Math.max(1e-6, Math.abs(magnitude) * 1e-6);
}

// |n · n'| above this: parallel planes (≈ 0.08°).
const PARALLEL_COS = 1 - 1e-6;

// Area change below this (relative) means the clip left the triangle whole.
const UNCHANGED_AREA_REL = 1e-9;

// Triangles of a geometry (indexed or not) as {a, b, c} of Vector3 (world
// values as stored), with the unit normal and plane offset `d` (n · a).
// Degenerate triangles are returned with `n: null`.
function readTriangles(geometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  const count = index ? index.count / 3 : position.count / 3;
  const triangles = [];
  const ab = new Vector3();
  const ac = new Vector3();
  for (let t = 0; t < count; t++) {
    const ia = index ? index.getX(3 * t) : 3 * t;
    const ib = index ? index.getX(3 * t + 1) : 3 * t + 1;
    const ic = index ? index.getX(3 * t + 2) : 3 * t + 2;
    const a = new Vector3().fromBufferAttribute(position, ia);
    const b = new Vector3().fromBufferAttribute(position, ib);
    const c = new Vector3().fromBufferAttribute(position, ic);
    const n = ab.subVectors(b, a).cross(ac.subVectors(c, a));
    const length = n.length();
    if (!(length > 0)) {
      triangles.push({ a, b, c, n: null, d: 0 });
      continue;
    }
    const normal = n.clone().divideScalar(length);
    triangles.push({ a, b, c, n: normal, d: normal.dot(a) });
  }
  return triangles;
}

function maxMagnitude(geometries) {
  let magnitude = 0;
  for (const geometry of geometries) {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || box.isEmpty()) continue;
    for (const corner of [box.min, box.max]) {
      magnitude = Math.max(
        magnitude,
        Math.abs(corner.x),
        Math.abs(corner.y),
        Math.abs(corner.z)
      );
    }
  }
  return magnitude;
}

// The plane of `plane` (unit normal + offset) holds this triangle, in either
// orientation.
function isOnPlane(plane, triangle, tolerance) {
  const cos = plane.n.dot(triangle.n);
  if (Math.abs(cos) < PARALLEL_COS) return false;
  const d = cos > 0 ? triangle.d : -triangle.d;
  return Math.abs(d - plane.d) < tolerance;
}

// Orthonormal in-plane basis (u, v) for a unit normal.
function planeBasis(n) {
  const helper =
    Math.abs(n.x) <= Math.abs(n.y) && Math.abs(n.x) <= Math.abs(n.z)
      ? new Vector3(1, 0, 0)
      : Math.abs(n.y) <= Math.abs(n.z)
        ? new Vector3(0, 1, 0)
        : new Vector3(0, 0, 1);
  const u = new Vector3().crossVectors(n, helper).normalize();
  const v = new Vector3().crossVectors(n, u);
  return { u, v };
}

const ringArea = (ring) => {
  let area = 0;
  for (let i = 0, l = ring.length; i < l; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % l];
    area += x0 * y1 - x1 * y0;
  }
  return Math.abs(area) / 2;
};

const multiPolygonArea = (multiPolygon) =>
  multiPolygon.reduce(
    (sum, polygon) =>
      sum +
      polygon.reduce(
        (acc, ring, i) => acc + (i === 0 ? 1 : -1) * ringArea(ring),
        0
      ),
    0
  );

// polygon-clipping repeats the first point at the end of each ring.
const openRing = (ring) => {
  const [x0, y0] = ring[0];
  const [x1, y1] = ring[ring.length - 1];
  return x0 === x1 && y0 === y1 ? ring.slice(0, -1) : ring;
};

/**
 * Exact 2D removal, from an OPEN sheet host, of the parts of its triangles
 * that lie ON a face of a cutter (coplanar contact): the hollow subtraction
 * of three-bvh-csg classifies such triangles by the orientation of the
 * cutter face (opposite normals → kept) and splits them unreliably, which
 * left a basin floor touched from below by a pit with a random, hatched
 * half of the pit footprint. For a sheet, the part lying on the cutter
 * boundary belongs to the cut.
 *
 * Every host triangle coplanar with a cutter triangle is clipped
 * (polygon-clipping difference, in the plane's own 2D basis) by all the
 * cutter triangles of that plane, and the remainder is re-triangulated
 * (ShapeUtils, outer ring + holes) with the original orientation. Triangles
 * the clip leaves whole are kept as they are, so the rest of the
 * tessellation does not move.
 *
 * @param {import("three").BufferGeometry} sourceGeometry host sheet, WORLD
 *   frame (indexed or not); not mutated.
 * @param {Array<import("three").BufferGeometry>} cutterGeometries cutter
 *   solids, WORLD frame.
 * @returns {import("three").BufferGeometry|null} the clipped host
 *   (non-indexed, position + normal), or null when nothing was coplanar.
 */
export default function clipCoplanarSheetTriangles(
  sourceGeometry,
  cutterGeometries
) {
  const hostTriangles = readTriangles(sourceGeometry);
  if (hostTriangles.length === 0) return null;
  const tolerance = coplanarTolerance(
    maxMagnitude([sourceGeometry, ...cutterGeometries])
  );

  // Host planes (first triangle's orientation), each with its triangles.
  const planes = [];
  hostTriangles.forEach((triangle, index) => {
    if (!triangle.n) return;
    let plane = planes.find((p) => isOnPlane(p, triangle, tolerance));
    if (!plane) {
      plane = { n: triangle.n, d: triangle.d, hostIndices: [], cutters: [] };
      planes.push(plane);
    }
    plane.hostIndices.push(index);
  });

  // Cutter triangles lying on a host plane.
  let hasContact = false;
  for (const geometry of cutterGeometries) {
    for (const triangle of readTriangles(geometry)) {
      if (!triangle.n) continue;
      const plane = planes.find((p) => isOnPlane(p, triangle, tolerance));
      if (!plane) continue;
      plane.cutters.push(triangle);
      hasContact = true;
    }
  }
  if (!hasContact) return null;

  const removed = new Set();
  const added = [];
  for (const plane of planes) {
    if (plane.cutters.length === 0) continue;
    const { u, v } = planeBasis(plane.n);
    const project = (p) => [p.dot(u), p.dot(v)];
    const cutterPolygons = plane.cutters.map((t) => [
      [project(t.a), project(t.b), project(t.c)],
    ]);
    const cutterBox = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
    for (const polygon of cutterPolygons) {
      for (const [x, y] of polygon[0]) {
        cutterBox.minX = Math.min(cutterBox.minX, x);
        cutterBox.minY = Math.min(cutterBox.minY, y);
        cutterBox.maxX = Math.max(cutterBox.maxX, x);
        cutterBox.maxY = Math.max(cutterBox.maxY, y);
      }
    }

    for (const index of plane.hostIndices) {
      const triangle = hostTriangles[index];
      const ring = [
        project(triangle.a),
        project(triangle.b),
        project(triangle.c),
      ];
      const xs = ring.map(([x]) => x);
      const ys = ring.map(([, y]) => y);
      if (
        Math.max(...xs) < cutterBox.minX - tolerance ||
        Math.min(...xs) > cutterBox.maxX + tolerance ||
        Math.max(...ys) < cutterBox.minY - tolerance ||
        Math.min(...ys) > cutterBox.maxY + tolerance
      ) {
        continue;
      }
      const area = ringArea(ring);
      if (!(area > 0)) continue;
      let remainder;
      try {
        remainder = polygonClipping.difference([ring], ...cutterPolygons);
      } catch (e) {
        console.warn("[clipCoplanarSheetTriangles] clip failed", e);
        continue;
      }
      if (
        Math.abs(multiPolygonArea(remainder) - area) <=
        UNCHANGED_AREA_REL * area
      ) {
        continue;
      }
      removed.add(index);

      // Lift the remainder back onto the triangle's own plane, keeping its
      // orientation.
      const offset = plane.n
        .clone()
        .multiplyScalar(triangle.n.dot(plane.n) > 0 ? triangle.d : -triangle.d);
      const lift = ([x, y]) =>
        new Vector3().copy(offset).addScaledVector(u, x).addScaledVector(v, y);
      for (const polygon of remainder) {
        const rings = polygon.map((r) =>
          openRing(r).map(([x, y]) => new Vector2(x, y))
        );
        const outer = rings[0];
        const holes = rings.slice(1);
        if (!outer || outer.length < 3) continue;
        const vertices = [...outer, ...holes.flat()];
        let faces;
        try {
          faces = ShapeUtils.triangulateShape(outer, holes);
        } catch (e) {
          console.warn("[clipCoplanarSheetTriangles] triangulation failed", e);
          continue;
        }
        for (const [i0, i1, i2] of faces) {
          const a = lift([vertices[i0].x, vertices[i0].y]);
          const b = lift([vertices[i1].x, vertices[i1].y]);
          const c = lift([vertices[i2].x, vertices[i2].y]);
          const n = new Vector3()
            .subVectors(b, a)
            .cross(new Vector3().subVectors(c, a));
          if (!(n.lengthSq() > 0)) continue;
          added.push(n.dot(triangle.n) >= 0 ? [a, b, c] : [a, c, b]);
        }
      }
    }
  }
  if (removed.size === 0) return null;

  const positions = [];
  hostTriangles.forEach((triangle, index) => {
    if (removed.has(index)) return;
    positions.push(
      ...triangle.a.toArray(),
      ...triangle.b.toArray(),
      ...triangle.c.toArray()
    );
  });
  for (const [a, b, c] of added) {
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
