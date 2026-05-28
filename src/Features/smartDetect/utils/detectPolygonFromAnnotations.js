import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import findPolygonCandidates from "./findPolygonCandidates";

// Cap the number of segments fed to the planar arrangement (O(n^2) split pass).
// Far-away geometry can't bound the loop around the cursor, so when a plan is
// very dense we keep only the segments closest to the mouse.
const MAX_SEGMENTS = 1500;

/**
 * detectPolygonFromAnnotations
 *
 * 1. Decompose annotations + drawingPoints into INDEPENDENT segments
 * 2. Call findPolygonCandidates → minimal closed loops of the planar arrangement
 * 3. Pick the smallest loop containing the mouse position
 * 4. Find cuts (closed loops fully inside the envelope)
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

  // Step 1: Decompose everything into independent segments
  let segments = extractSegments(annotations, drawingPoints);
  if (segments.length === 0) return null;
  if (segments.length > MAX_SEGMENTS) {
    segments = keepClosestSegments(segments, mousePos, MAX_SEGMENTS);
  }

  // Step 2: Minimal closed loops of the planar arrangement
  const candidates = findPolygonCandidates(segments, tolerance);

  if (candidates.length === 0) return null;

  // Step 3: Find the smallest candidate containing mousePos
  const envelope = selectEnvelope(candidates, mousePos);
  if (!envelope) return null;

  // Step 3b: Skip if envelope matches an existing POLYGON annotation
  const matchingExisting = findMatchingExistingPolygon(annotations, envelope);
  if (matchingExisting) {
    const cutContainingMouse = findCutContainingMouse(
      matchingExisting,
      mousePos
    );
    if (cutContainingMouse) {
      const innerEnvelope = selectEnvelopeInsideRegion(
        candidates,
        mousePos,
        cutContainingMouse
      );
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
// Decompose annotations → independent segments
// ---------------------------------------------------------------------------

function extractSegments(annotations, drawingPoints) {
  const segments = [];

  // Push every consecutive point pair of a (arc-expanded) path as its own
  // segment. `closed` adds the wrap-around segment back to the first point.
  const pushPath = (rawPts, closed) => {
    if (!rawPts || rawPts.length < 2) return;
    const pts = expandArcsInPath(rawPts, 6);
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push({
        a: { x: pts[i].x, y: pts[i].y },
        b: { x: pts[i + 1].x, y: pts[i + 1].y },
      });
    }
    if (closed && pts.length >= 3) {
      const f = pts[0];
      const l = pts[pts.length - 1];
      if ((f.x - l.x) ** 2 + (f.y - l.y) ** 2 > 1e-6) {
        segments.push({
          a: { x: l.x, y: l.y },
          b: { x: f.x, y: f.y },
        });
      }
    }
  };

  for (const ann of annotations) {
    if (!ann.points || ann.points.length < 2) continue;
    const pts = ann.points.map((p) => ({ x: p.x, y: p.y, type: p.type }));

    if (ann.type === "POLYGON") {
      pushPath(pts, true);
      // A polygon's holes are independent loops too — include their edges.
      if (Array.isArray(ann.cuts)) {
        for (const cut of ann.cuts) {
          if (cut?.points?.length >= 2) {
            pushPath(
              cut.points.map((p) => ({ x: p.x, y: p.y, type: p.type })),
              true
            );
          }
        }
      }
    } else if (ann.type === "POLYLINE") {
      pushPath(pts, !!ann.closeLine);
    }
  }

  if (drawingPoints && drawingPoints.length >= 2) {
    pushPath(
      drawingPoints.map((p) => ({ x: p.x, y: p.y })),
      false
    );
  }

  return segments;
}

// Keep the `limit` segments closest to `mousePos` (by min distance from the
// point to the segment), so dense plans stay within the O(n^2) split budget.
function keepClosestSegments(segments, mousePos, limit) {
  const scored = segments.map((s) => ({
    s,
    d: pointToSegmentDistSq(mousePos, s.a, s.b),
  }));
  scored.sort((p, q) => p.d - q.d);
  return scored.slice(0, limit).map((e) => e.s);
}

function pointToSegmentDistSq(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return (p.x - px) ** 2 + (p.y - py) ** 2;
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
    if (envelopeArea > 0 && Math.abs(area - envelopeArea) / envelopeArea < 0.01)
      continue;
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
    if (ann.type !== "POLYGON" || !ann.points || ann.points.length < 3)
      continue;

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
    const a = ring[i],
      b = ring[i + 1];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq)
    );
    const px = a.x + t * dx,
      py = a.y + t * dy;
    if ((point.x - px) ** 2 + (point.y - py) ** 2 <= thSq) return true;
  }
  return false;
}

export function pointInPolygon(point, ring) {
  let inside = false;
  const n = ring.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].x,
      yi = ring[i].y;
    const xj = ring[j].x,
      yj = ring[j].y;

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
