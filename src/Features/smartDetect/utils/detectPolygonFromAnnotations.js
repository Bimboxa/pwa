import findPolygonCandidates from "./findPolygonCandidates";

/**
 * detectPolygonFromAnnotations
 *
 * 1. Normalize annotations + drawingPoints into paths (arrays of ordered points)
 * 2. Call findPolygonCandidates to get all closed polygon candidates
 * 3. Pick the smallest one containing the mouse position
 * 4. Find cuts (existing closed annotations inside the envelope)
 *
 * @param {Object} params
 * @param {Array} params.annotations - Resolved annotations with {type, points, closeLine, cuts}
 * @param {Array<{x:number, y:number}>} params.drawingPoints - Current drawing points in progress
 * @param {{x:number, y:number}} params.mousePos - Mouse position in local coords
 * @param {number} [params.tolerance=5] - Endpoint merge tolerance in pixels
 * @returns {{ outerRing: Array<{x,y}>, cuts: Array<Array<{x,y}>> } | null}
 */
export default function detectPolygonFromAnnotations({
  annotations,
  drawingPoints,
  mousePos,
  tolerance = 5,
}) {
  if (!annotations || !mousePos) return null;

  // Step 1: Normalize all annotations into paths
  const paths = extractPaths(annotations, drawingPoints, tolerance);
  if (paths.length === 0) return null;

  // Step 2: Find all polygon candidates (pure geometry)
  const candidates = findPolygonCandidates(paths, tolerance);

  if (candidates.length === 0) return null;

  // Step 3: Find the smallest candidate containing mousePos
  const envelope = selectEnvelope(candidates, mousePos);
  if (!envelope) return null;

  // Step 3b: Skip if envelope matches an existing POLYGON annotation
  const matchingExisting = findMatchingExistingPolygon(annotations, envelope);
  if (matchingExisting) {
    const cutContainingMouse = findCutContainingMouse(matchingExisting, mousePos);
    if (cutContainingMouse) {
      const innerEnvelope = selectEnvelopeInsideRegion(candidates, mousePos, cutContainingMouse);
      if (innerEnvelope) {
        const innerCuts = findCutsFromCycles(candidates, innerEnvelope);
        return { outerRing: innerEnvelope, cuts: innerCuts };
      }
    }
    return null;
  }

  // Step 4: Find cuts — other DFS cycles fully inside the envelope
  const cuts = findCutsFromCycles(candidates, envelope);

  return { outerRing: envelope, cuts };
}

// ---------------------------------------------------------------------------
// Normalize annotations → paths
// ---------------------------------------------------------------------------

function extractPaths(annotations, drawingPoints, tolerance) {
  const tolSq = tolerance * tolerance;
  const paths = [];

  for (const ann of annotations) {
    if (!ann.points || ann.points.length < 2) continue;

    if (ann.type === "POLYLINE") {
      const pts = ann.points.map((p) => ({ x: p.x, y: p.y, _id: p.id }));
      if (pts.length >= 3) {
        const first = pts[0], last = pts[pts.length - 1];
        const dSq = (first.x - last.x) ** 2 + (first.y - last.y) ** 2;
        if (dSq <= tolSq || (first._id && first._id === last._id)) {
          // First ≈ last (or same ID): snap last to exact first position
          pts[pts.length - 1] = { ...first };
        } else if (ann.closeLine) {
          // closeLine: append first point to close the path (don't replace last!)
          pts.push({ ...first });
        }
      }
      paths.push(pts);
    } else if (ann.type === "POLYGON") {
      const ring = ann.points.map((p) => ({ x: p.x, y: p.y, _id: p.id }));
      if (ring.length >= 3) {
        ring.push({ ...ring[0] });
        paths.push(ring);
      }
    }
  }

  if (drawingPoints && drawingPoints.length >= 2) {
    const pts = drawingPoints.map((p) => ({ x: p.x, y: p.y }));
    if (pts.length >= 3) {
      const first = pts[0], last = pts[pts.length - 1];
      const dSq = (first.x - last.x) ** 2 + (first.y - last.y) ** 2;
      if (dSq <= tolSq) {
        pts[pts.length - 1] = { x: first.x, y: first.y };
      }
    }
    paths.push(pts);
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Envelope selection
// ---------------------------------------------------------------------------

function selectEnvelope(candidates, mousePos) {
  let bestRing = null;
  let bestArea = Infinity;

  for (const ring of candidates) {
    if (pointInPolygon(mousePos, ring)) {
      const area = Math.abs(polygonArea(ring));
      if (area < bestArea && area > 0) {
        bestArea = area;
        bestRing = ring;
      }
    }
  }

  return bestRing;
}

// ---------------------------------------------------------------------------
// Cuts detection
// ---------------------------------------------------------------------------

/**
 * Find cuts from DFS-detected cycles: any cycle that is smaller than
 * the envelope AND fully inside it becomes a cut (hole).
 */
function findCutsFromCycles(allCycles, envelope) {
  const cuts = [];
  const envelopeArea = Math.abs(polygonArea(envelope));

  for (const ring of allCycles) {
    const area = Math.abs(polygonArea(ring));
    // Skip the envelope itself (same area)
    if (envelopeArea > 0 && Math.abs(area - envelopeArea) / envelopeArea < 0.01) continue;
    // Must be smaller
    if (area >= envelopeArea) continue;
    // All points must be inside the envelope
    if (!ring.every((p) => pointInPolygon(p, envelope))) continue;

    cuts.push(ring);
  }

  return cuts;
}

// ---------------------------------------------------------------------------
// Existing polygon matching (skip re-detection)
// ---------------------------------------------------------------------------

function findMatchingExistingPolygon(annotations, envelope) {
  const envArea = Math.abs(polygonArea(envelope));
  if (envArea === 0) return null;

  for (const ann of annotations) {
    if (ann.type !== "POLYGON" || !ann.points || ann.points.length < 3) continue;

    const annArea = Math.abs(polygonArea(ann.points));
    if (Math.abs(annArea - envArea) / envArea > 0.05) continue;

    const allClose = ann.points.every(
      (p) => pointInPolygon(p, envelope) || isPointNearRing(p, envelope, 10)
    );
    if (allClose) return ann;
  }

  return null;
}

function findCutContainingMouse(annotation, mousePos) {
  if (!annotation.cuts || annotation.cuts.length === 0) return null;

  for (const cut of annotation.cuts) {
    if (!cut.points || cut.points.length < 3) continue;
    const ring = cut.points.map((p) => ({ x: p.x, y: p.y }));
    const closed = [...ring, { x: ring[0].x, y: ring[0].y }];
    if (pointInPolygon(mousePos, closed)) return closed;
  }

  return null;
}

function selectEnvelopeInsideRegion(candidates, mousePos, regionRing) {
  let bestRing = null;
  let bestArea = Infinity;

  for (const ring of candidates) {
    if (!pointInPolygon(mousePos, ring)) continue;
    const area = Math.abs(polygonArea(ring));
    if (area >= bestArea || area === 0) continue;

    const allInside = ring.every(
      (p) => pointInPolygon(p, regionRing) || isPointNearRing(p, regionRing, 10)
    );
    if (allInside) {
      bestArea = area;
      bestRing = ring;
    }
  }

  return bestRing;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function isPointNearRing(point, ring, threshold) {
  const thSq = threshold * threshold;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
    const px = a.x + t * dx, py = a.y + t * dy;
    if ((point.x - px) ** 2 + (point.y - py) ** 2 <= thSq) return true;
  }
  return false;
}

export function pointInPolygon(point, ring) {
  let inside = false;
  const n = ring.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].x, yi = ring[i].y;
    const xj = ring[j].x, yj = ring[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

export function polygonArea(ring) {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i].x * ring[j].y;
    area -= ring[j].x * ring[i].y;
  }
  return area / 2;
}
