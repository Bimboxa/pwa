// « Pinceau » on the lateral facet of a thick wall: the stretches of the
// facet standing on a floor polygon, on its painted side — the base
// segments of the vertical surface(s) the brush creates. Same construction
// as the SURFACES_VERTICALES procedure, seen from the wall: the facet's plan
// segment is cut at the projections of the floor contour vertices and at
// its intersections with the floor contours, then each piece is kept when a
// point probed just beside it, on the painted side, falls inside a floor
// polygon (the floor does not have to run along the facet: a wall standing
// in the middle of a slab is "on" that slab).
//
// Pixel space (resolved annotations). Pure: node-testable, relative imports.
//
// guideEdges: [{ax, ay, bx, by, nx, ny, topZ}] — the facet's plan segments
//   (one per painted planar facet), (nx, ny) UNIT normal in px toward the
//   painted side, topZ the facet's top (base-map-local meters, absolute).
// polygons: [{id, baseZ, sloped, rings: [{kind: "MAIN"|"CUT", points}],
//   contains(pt), bottomAt(pt)}] — see collectGroundPolygonsFromScene;
//   bottomAt in the same z frame as topZ.
// tolPx: floor detection distance (0.05 m / meterByPx); probePx: side probe
//   distance (defaults to tolPx).
//
// Returns [{polygonId, baseZ, sloped, closeLine: false, topZ, points: [{x, y,
//   bottomZ, topZ}]}] — one run per contiguous stretch of one guide edge on
//   one floor polygon; a run breaks where the floor polygon or the facet top
//   changes. Several floors under one probe: the highest floor wins (the one
//   the wall stands on).

// A band thinner than this (m) is not a surface.
export const MIN_BAND_HEIGHT_M = 1e-3;
// Pieces shorter than this (px) are noise of the subdivision.
const MIN_PIECE_PX = 0.5;
const T_EPS = 1e-6;

// Even-odd point-in-ring test (ring without closing duplicate).
export function pointInRing(pt, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

// contains(pt) of a polygon given its rings: inside the MAIN ring, outside
// every CUT ring.
export function makeRingsContains(rings) {
  const main = rings.find((ring) => ring.kind === "MAIN")?.points ?? null;
  const cuts = rings
    .filter((ring) => ring.kind === "CUT")
    .map((ring) => ring.points);
  return (pt) => {
    if (!main || !pointInRing(pt, main)) return false;
    return !cuts.some((cut) => pointInRing(pt, cut));
  };
}

// Parameters t ∈ (0, 1) along [a, b] where the floor contours cut the
// segment: projections of contour vertices within tolPx, and intersections
// with contour edges.
function collectSplits(edge, polygons, tolPx) {
  const ux = edge.bx - edge.ax;
  const uy = edge.by - edge.ay;
  const lenSq = ux * ux + uy * uy;
  if (lenSq < 1e-12) return [];
  const splits = [];
  const pushT = (t) => {
    if (t > T_EPS && t < 1 - T_EPS) splits.push(t);
  };
  for (const polygon of polygons) {
    for (const ring of polygon.rings || []) {
      const pts = ring.points || [];
      const n = pts.length;
      const edgeCount = ring.closed === false ? n - 1 : n;
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        // vertex projection
        const t = ((p.x - edge.ax) * ux + (p.y - edge.ay) * uy) / lenSq;
        if (t > T_EPS && t < 1 - T_EPS) {
          const px = edge.ax + t * ux;
          const py = edge.ay + t * uy;
          if (Math.hypot(p.x - px, p.y - py) <= tolPx) pushT(t);
        }
        // edge intersection
        if (i >= edgeCount) continue;
        const q = pts[(i + 1) % n];
        const vx = q.x - p.x;
        const vy = q.y - p.y;
        const denom = ux * vy - uy * vx;
        if (Math.abs(denom) < 1e-12) continue;
        const wx = p.x - edge.ax;
        const wy = p.y - edge.ay;
        const tI = (wx * vy - wy * vx) / denom;
        const s = (wx * uy - wy * ux) / denom;
        if (s >= -T_EPS && s <= 1 + T_EPS) pushT(tI);
      }
    }
  }
  return splits;
}

function walkGuideEdge(edge, { polygons, tolPx, probePx }) {
  const splits = [0, ...collectSplits(edge, polygons, tolPx), 1].sort(
    (a, b) => a - b
  );
  const at = (t) => ({
    x: edge.ax + t * (edge.bx - edge.ax),
    y: edge.ay + t * (edge.by - edge.ay),
  });

  // One slot per piece, in order: {from, to, polygon} or null.
  const slots = [];
  let last = null;
  for (let i = 0; i < splits.length - 1; i++) {
    const t0 = splits[i];
    const t1 = splits[i + 1];
    if (t1 - t0 < T_EPS) continue;
    const p = at(t0);
    const q = at(t1);
    let slot = null;
    if (Math.hypot(q.x - p.x, q.y - p.y) >= MIN_PIECE_PX) {
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      const probe = {
        x: mid.x + edge.nx * probePx,
        y: mid.y + edge.ny * probePx,
      };
      let floor = null;
      let floorZ = -Infinity;
      for (const polygon of polygons) {
        if (!polygon.contains(probe)) continue;
        const z = polygon.bottomAt(mid);
        if (z > floorZ) {
          floor = polygon;
          floorZ = z;
        }
      }
      if (floor && edge.topZ - floorZ > MIN_BAND_HEIGHT_M) {
        slot = { from: p, to: q, polygon: floor };
      }
    }
    if (slot && last && last.polygon === slot.polygon) {
      last.to = slot.to;
    } else {
      slots.push(slot);
      last = slot;
    }
  }

  const runs = [];
  for (const slot of slots) {
    if (!slot) continue;
    const { polygon } = slot;
    runs.push({
      polygonId: polygon.id,
      baseZ: polygon.baseZ,
      sloped: Boolean(polygon.sloped),
      closeLine: false,
      topZ: edge.topZ,
      points: [slot.from, slot.to].map((pt) => ({
        x: pt.x,
        y: pt.y,
        bottomZ: polygon.bottomAt(pt),
        topZ: edge.topZ,
      })),
    });
  }
  return runs;
}

export default function matchWallFaceToGroundPolygons({
  guideEdges,
  polygons,
  tolPx,
  probePx = tolPx,
}) {
  if (!guideEdges?.length || !polygons?.length) return [];
  const runs = [];
  for (const edge of guideEdges) {
    if (!Number.isFinite(edge?.topZ)) continue;
    runs.push(...walkGuideEdge(edge, { polygons, tolPx, probePx }));
  }
  return runs;
}
