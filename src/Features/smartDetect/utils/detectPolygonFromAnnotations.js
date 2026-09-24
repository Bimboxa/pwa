import {
  expandArcsInPathAdaptive,
  typeOf,
  circleFromThreePoints,
} from "Features/geometry/utils/arcSampling";
import collapseArcsInPolyline from "Features/geometry/utils/collapseArcsInPolyline";
import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import { getStripDistancePx } from "Features/geometry/utils/getStripePolygons";

import findPolygonCandidates from "./findPolygonCandidates";

// Cap the number of segments fed to the planar arrangement (O(n^2) split pass).
// Far-away geometry can't bound the loop around the cursor, so when a plan is
// very dense we keep only the segments closest to the mouse.
const MAX_SEGMENTS = 1500;

/**
 * detectPolygonFromAnnotations
 *
 * 1. Decompose annotations (POLYGON + cuts, POLYLINE, STRIP) + drawingPoints
 *    into INDEPENDENT segments
 * 2. Call findPolygonCandidates → minimal closed loops of the planar arrangement
 * 3. Pick the smallest loop containing the mouse position
 * 4. Find cuts (closed loops fully inside the envelope)
 *
 * @param {Object} params
 * @param {Array} params.annotations - Resolved annotations with {type, points, closeLine, cuts}
 * @param {Array<{x:number, y:number}>} params.drawingPoints - Current drawing points in progress
 * @param {{x:number, y:number}} params.mousePos - Mouse position in local coords
 * @param {number} [params.tolerance=5] - Endpoint merge tolerance in pixels
 * @param {number} [params.meterByPx] - Base map scale, needed to resolve the
 *   band width of STRIP / thick POLYLINE annotations (CM stroke widths)
 * @returns {{ outerRing: Array<{x,y,type?}>, cuts: Array<Array<{x,y,type?}>> } | null}
 *
 * The returned rings carry per-point `type` ("circle" on arc midpoints,
 * "square" otherwise): arcs from the source annotations are recovered on the
 * generated contour instead of staying faceted (see `collapseRingToTypedPoints`).
 */
export default function detectPolygonFromAnnotations({
  annotations,
  drawingPoints,
  mousePos,
  tolerance = 5,
  meterByPx,
}) {
  if (!annotations || !mousePos) return null;

  // Step 1: Decompose everything into independent segments. We also collect the
  // source annotations' arc circles so the discretized contour can be collapsed
  // back into S-C-S arcs at the end (concentric with the original arcs).
  let { segments, sourceArcCircles } = extractSegments(
    annotations,
    drawingPoints,
    tolerance,
    meterByPx
  );
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
        const innerCuts = findCutsFromCycles(
          candidates,
          innerEnvelope,
          tolerance
        );
        return {
          outerRing: collapseRingToTypedPoints(
            innerEnvelope,
            sourceArcCircles,
            tolerance
          ),
          cuts: innerCuts.map((c) =>
            collapseRingToTypedPoints(c, sourceArcCircles, tolerance)
          ),
        };
      }
    }
    return null;
  }

  // Step 4: Find cuts — other DFS cycles fully inside the envelope
  const cuts = findCutsFromCycles(candidates, envelope, tolerance);

  return {
    outerRing: collapseRingToTypedPoints(envelope, sourceArcCircles, tolerance),
    cuts: cuts.map((c) =>
      collapseRingToTypedPoints(c, sourceArcCircles, tolerance)
    ),
  };
}

// ---------------------------------------------------------------------------
// Decompose annotations → independent segments
// ---------------------------------------------------------------------------

// Stroke width of a POLYLINE in image pixels (CM converted via meterByPx,
// mirrors getAnnotationAsPolygons). 0 when unknown.
function getStrokeWidthPx(ann, meterByPx) {
  const w = Number(ann?.strokeWidth) || 0;
  if (w <= 0) return 0;
  if (ann.strokeWidthUnit === "CM") {
    return meterByPx > 0 ? (w * 0.01) / meterByPx : 0;
  }
  return w;
}

function extractSegments(annotations, drawingPoints, tolerance = 5, meterByPx) {
  const segments = [];
  const sourceArcCircles = [];

  // Sample arcs so each chord stays well above the planar-arrangement merge
  // tolerance — otherwise a small arc's sub-tolerance sub-segments get dropped
  // in findPolygonCandidates and the loop never closes.
  const targetChordPx = Math.max(10, 2.4 * tolerance);

  // Collect the circle of every S-C-S (square→circle→square) arc in a typed
  // path, so the discretized contour can later be collapsed back to arcs
  // concentric with these source circles. Mirrors the wrap-around walk of
  // `expandArcsInPath` so a closed path's seam arc is captured too.
  const collectArcCircles = (typedPts, closed) => {
    const n = typedPts.length;
    if (n < 3) return;
    const get = closed
      ? (k) => typedPts[((k % n) + n) % n]
      : (k) => typedPts[k];
    const last = closed ? n - 1 : n - 3;
    for (let i = 0; i <= last; i++) {
      const p0 = get(i);
      const p1 = get(i + 1);
      const p2 = get(i + 2);
      if (
        p1 &&
        p2 &&
        typeOf(p0) !== "circle" &&
        typeOf(p1) === "circle" &&
        typeOf(p2) !== "circle"
      ) {
        const circ = circleFromThreePoints(p0, p1, p2);
        if (circ && Number.isFinite(circ.r) && circ.r > 0) {
          sourceArcCircles.push(circ);
        }
      }
    }
  };

  // Push every consecutive point pair of a (arc-expanded) path as its own
  // segment. `closed` adds the wrap-around segment back to the first point.
  const pushPath = (rawPts, closed) => {
    if (!rawPts || rawPts.length < 2) return;
    collectArcCircles(rawPts, closed);
    const pts = expandArcsInPathAdaptive(rawPts, targetChordPx);
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
      // Thick polylines (walls drawn with a CM stroke width) are bounded by
      // their two faces, not their axis: a contour snapped to a visible face
      // sits half a stroke away from the centerline. Thin lines keep the
      // centerline (their band would collapse under the weld tolerance).
      const halfWidth = getStrokeWidthPx(ann, meterByPx) / 2;
      if (halfWidth > tolerance) pushBandOutline(ann, pts, halfWidth);
      else pushPath(pts, !!ann.closeLine);
    } else if (ann.type === "STRIP") {
      pushBandOutline(ann, pts, Math.abs(getStripDistancePx(ann, meterByPx)));
    }
  }

  if (drawingPoints && drawingPoints.length >= 2) {
    pushPath(
      drawingPoints.map((p) => ({ x: p.x, y: p.y })),
      false
    );
  }

  return { segments, sourceArcCircles };

  // Feed the full band footprint of a wall-like annotation (both faces + end
  // caps, openings carved) — the same polygons the renderer / quantities use
  // (getAnnotationAsPolygons). A STRIP's band is offset to ONE side of its
  // drawn line (stripOrientation), a thick POLYLINE's band is symmetric: in
  // both cases the face a room stops at is a band edge, so a contour snapped
  // to any visible edge closes the loop. Falls back to the drawn line when
  // the band cannot be built. `edgeOffsetPx` is the distance from the drawn
  // arcs to the band edges, used to register the concentric arc circles.
  function pushBandOutline(ann, typedPts, edgeOffsetPx) {
    let shapes = [];
    try {
      shapes = getAnnotationAsPolygons(ann, { meterByPx }) || [];
    } catch {
      shapes = [];
    }
    if (shapes.length === 0) {
      pushPath(typedPts, !!ann.closeLine);
      return;
    }
    // Band edges are concentric with the drawn arcs: register both offset
    // radii so the discretized contour can still be collapsed back to arcs.
    const before = sourceArcCircles.length;
    collectArcCircles(typedPts, !!ann.closeLine);
    const d = Math.abs(edgeOffsetPx) || 0;
    if (d > 0) {
      // Snapshot the range: the loop appends to the array it reads from.
      const drawnArcs = sourceArcCircles.slice(before);
      for (const c of drawnArcs) {
        sourceArcCircles.push({ center: c.center, r: c.r + d });
        if (c.r - d > 0)
          sourceArcCircles.push({ center: c.center, r: c.r - d });
      }
    }
    for (const shape of shapes) {
      if (shape?.points?.length >= 3) {
        pushPath(
          shape.points.map((p) => ({ x: p.x, y: p.y })),
          true
        );
      }
      if (Array.isArray(shape?.cuts)) {
        for (const cut of shape.cuts) {
          if (cut?.points?.length >= 3) {
            pushPath(
              cut.points.map((p) => ({ x: p.x, y: p.y })),
              true
            );
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Arc recovery on the generated contour
// ---------------------------------------------------------------------------

// True when `p` lies (within `tol`) on the circumference of any source arc
// circle — used to pick a seam vertex that is a real corner, not mid-arc.
function pointOnAnySourceArc(p, sourceArcCircles, tol) {
  for (const c of sourceArcCircles) {
    if (!c || !c.center) continue;
    const d = Math.abs(Math.hypot(p.x - c.center.x, p.y - c.center.y) - c.r);
    if (d <= tol) return true;
  }
  return false;
}

/**
 * Convert a closed ring of plain {x,y} (ring[last] === ring[0]) into a typed
 * point array where arc midpoints carry `type:"circle"`. Straight runs and
 * corners stay `type:"square"`.
 *
 * Discretized runs that lie on a source annotation arc circle are collapsed
 * back into S-C-S arcs via `collapseArcsInPolyline` with `requireSourceMatch`
 * (so only real source arcs are recovered — corners stay corners). When no
 * source arcs exist the ring passes through as all-square points.
 */
function collapseRingToTypedPoints(ring, sourceArcCircles, tolerance) {
  if (!ring || ring.length < 4) {
    return (ring || []).map((p) => ({ x: p.x, y: p.y, type: "square" }));
  }

  // Strip the duplicate closing vertex → open list of distinct vertices.
  let verts = ring.slice(0, ring.length - 1).map((p) => ({ x: p.x, y: p.y }));

  if (!sourceArcCircles || sourceArcCircles.length === 0) {
    return [...verts, { x: verts[0].x, y: verts[0].y }].map((p) => ({
      x: p.x,
      y: p.y,
      type: "square",
    }));
  }

  // Seam handling: rotate so the array starts at a real corner (a vertex NOT on
  // any source arc), so no recovered arc straddles the array seam. If every
  // vertex lies on a circle (fully-circular contour), keep index 0.
  const seamTol = Math.max(2, tolerance);
  let seam = verts.findIndex(
    (p) => !pointOnAnySourceArc(p, sourceArcCircles, seamTol)
  );
  if (seam > 0) {
    verts = verts.slice(seam).concat(verts.slice(0, seam));
  }

  // Run the collapse on the closed path (append the seam vertex so the
  // wrap-around segment is considered).
  const units = collapseArcsInPolyline(
    [...verts, { x: verts[0].x, y: verts[0].y }],
    {
      thicknessPx: 2 * tolerance,
      sourceArcCircles,
      requireSourceMatch: true,
    }
  );

  // Flatten units → typed points, deduping shared boundary vertices.
  const out = [];
  const push = (x, y, type) => {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - x) < 1e-6 && Math.abs(last.y - y) < 1e-6) {
      return; // shared boundary vertex
    }
    out.push({ x, y, type });
  };
  if (units.length === 0) {
    for (const p of verts) push(p.x, p.y, "square");
  } else {
    for (const unit of units) {
      if (unit.kind === "arc") {
        const [a, c, b] = unit.points; // [square, circle, square]
        push(a.x, a.y, "square");
        push(c.x, c.y, "circle");
        push(b.x, b.y, "square");
      } else {
        for (const p of unit.points) push(p.x, p.y, "square");
      }
    }
  }

  // Re-close the ring (drop a trailing duplicate of the first vertex first, so
  // the closing point is appended exactly once).
  if (out.length >= 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (
      Math.abs(first.x - last.x) < 1e-6 &&
      Math.abs(first.y - last.y) < 1e-6
    ) {
      out.pop();
    }
    out.push({ x: first.x, y: first.y, type: "square" });
  }

  return out;
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
 *
 * A cycle that touches the envelope boundary is a neighbouring face (a wall
 * band the contour already wraps around, an adjacent room…), not a hole:
 * `pointInPolygon` is undefined for on-boundary vertices, so such cycles
 * are rejected explicitly instead of relying on the ray-cast's luck.
 */
function findCutsFromCycles(allCycles, envelope, tolerance = 5) {
  const cuts = [];
  const envelopeArea = Math.abs(polygonArea(envelope));
  const touchTol = Math.max(1e-3, tolerance);

  for (const ring of allCycles) {
    const area = Math.abs(polygonArea(ring));
    // Skip the envelope itself (same area)
    if (envelopeArea > 0 && Math.abs(area - envelopeArea) / envelopeArea < 0.01)
      continue;
    // Must be smaller
    if (area >= envelopeArea) continue;
    // Must not share the envelope boundary (neighbouring face, not a hole)
    if (ring.some((p) => isPointNearRing(p, envelope, touchTol))) continue;
    // All points must be inside the envelope
    if (!ring.every((p) => pointInPolygon(p, envelope))) continue;

    cuts.push({ ring, area });
  }

  // Keep only the OUTERMOST cycles. A connected group of wall bands (two
  // interior walls meeting in a T, a closed partition…) yields every face of
  // its planar arrangement — each band piece, each overlap, each enclosed
  // room — plus the outline of the whole group. Only that outline is a hole
  // of the surface; the nested faces would overlap it and each other.
  const isNested = (inner, outer) =>
    inner.every(
      (p) => pointInPolygon(p, outer) || isPointNearRing(p, outer, touchTol)
    );
  return cuts
    .filter(
      (c, i) =>
        !cuts.some(
          (o, j) =>
            j !== i &&
            (o.area > c.area || (o.area === c.area && j < i)) &&
            isNested(c.ring, o.ring)
        )
    )
    .map((c) => c.ring);
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
