import polygonClipping from "polygon-clipping";

import { MIN_PROJECTION_WIDTH_M } from "./mesh3dConstants.js";
import { getFaceLoops } from "./mesh3dTopology.js";

// Plan projection of a mesh: the silhouette its faces cast on the base map
// plane (local z dropped), as ONE polygon with holes — what the 2D
// annotation of an isMesh3d annotation draws.
//
// Returns { contour: [{x, y}], holes: [[{x, y}]] } in local meters (open
// loops), or null for an empty mesh.

// Snap grid (meters) applied before the union so the shared edges of
// neighbor faces land on identical coordinates.
const SNAP_M = 1e-6;
// Faces seen edge-on project to a sliver: no area, and they make the union
// solver choke.
const MIN_FACE_AREA_M2 = 1e-8;
const COLLINEAR_SIN = 1e-6;

const snap = (v) => Math.round(v / SNAP_M) * SNAP_M;

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function openRing(ring) {
  const out = ring.slice(0, ring.length - 1).map(([x, y]) => ({ x, y }));
  // Drop the mid-edge vertices left by the union along dissolved seams.
  const cleaned = [];
  for (let i = 0; i < out.length; i++) {
    const prev = out[(i - 1 + out.length) % out.length];
    const p = out[i];
    const next = out[(i + 1) % out.length];
    const e1x = p.x - prev.x;
    const e1y = p.y - prev.y;
    const e2x = next.x - p.x;
    const e2y = next.y - p.y;
    const l1 = Math.hypot(e1x, e1y);
    const l2 = Math.hypot(e2x, e2y);
    if (l1 === 0 || l2 === 0) continue;
    if (Math.abs(e1x * e2y - e1y * e2x) / (l1 * l2) > COLLINEAR_SIN) {
      cleaned.push(p);
    }
  }
  return cleaned;
}

// No face has a plan area (e.g. a single vertical face): a thin quad around
// the projected segment keeps the 2D annotation a valid polygon.
function buildThinQuad(vertices) {
  let a = null;
  let b = null;
  let best = -1;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const d = Math.hypot(
        vertices[i].x - vertices[j].x,
        vertices[i].y - vertices[j].y
      );
      if (d > best) {
        best = d;
        a = vertices[i];
        b = vertices[j];
      }
    }
  }
  if (!a || !b) return null;
  const half = MIN_PROJECTION_WIDTH_M / 2;
  let ux = b.x - a.x;
  let uy = b.y - a.y;
  const len = Math.hypot(ux, uy);
  if (len < 1e-9) {
    ux = 1;
    uy = 0;
  } else {
    ux /= len;
    uy /= len;
  }
  const nx = -uy * half;
  const ny = ux * half;
  // A point-like projection still gets a small square.
  const ex = len < 1e-9 ? ux * half : 0;
  const ey = len < 1e-9 ? uy * half : 0;
  return {
    contour: [
      { x: a.x - ex - nx, y: a.y - ey - ny },
      { x: b.x + ex - nx, y: b.y + ey - ny },
      { x: b.x + ex + nx, y: b.y + ey + ny },
      { x: a.x - ex + nx, y: a.y - ey + ny },
    ],
    holes: [],
  };
}

export default function projectMesh3dToRings(mesh) {
  if (!mesh?.vertices?.length || !mesh?.faces?.length) return null;
  const { vertices, faces } = mesh;

  const polygons = [];
  for (const face of faces) {
    const rings = getFaceLoops(face)
      .map((loop) =>
        loop.map((vi) => [snap(vertices[vi].x), snap(vertices[vi].y)])
      )
      .filter((ring) => ring.length >= 3);
    if (!rings.length || Math.abs(ringArea(rings[0])) < MIN_FACE_AREA_M2) {
      continue;
    }
    polygons.push(
      rings
        .filter((ring, i) => i === 0 || Math.abs(ringArea(ring)) > 0)
        .map((ring) => [...ring, ring[0]])
    );
  }
  if (!polygons.length) return buildThinQuad(vertices);

  let merged;
  try {
    merged = polygonClipping.union(polygons[0], ...polygons.slice(1));
  } catch (error) {
    console.error("[projectMesh3dToRings] polygon-clipping error:", error);
    return buildThinQuad(vertices);
  }

  // A connected mesh casts one polygon; keep the largest if numerical noise
  // (or a non-connected mesh) yields several.
  let best = null;
  let bestArea = 0;
  for (const polygon of merged || []) {
    if (!polygon.length) continue;
    const area = Math.abs(ringArea(polygon[0].slice(0, -1)));
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  if (!best) return buildThinQuad(vertices);

  const contour = openRing(best[0]);
  if (contour.length < 3) return buildThinQuad(vertices);
  return {
    contour,
    holes: best
      .slice(1)
      .map(openRing)
      .filter((hole) => hole.length >= 3),
  };
}
