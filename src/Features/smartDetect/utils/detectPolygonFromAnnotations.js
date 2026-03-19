/**
 * detectPolygonFromAnnotations
 *
 * Detects a closed polygon boundary from existing visible annotations + current
 * drawingPoints. The drawingPoints participate as additional segments that can
 * "close" otherwise-open polylines from annotations.
 *
 * Algorithm:
 * 1. Extract all polylines from annotations + drawingPoints
 * 2. Identify directly closed polylines (start ≈ end)
 * 3. Try to chain open polylines end-to-end to form closed loops
 * 4. Pick the smallest closed loop that contains mousePos as the outer envelope
 * 5. Find existing closed annotations fully inside the envelope as cuts
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

  // Step 1: Extract all polylines
  const polylines = extractPolylines(annotations, drawingPoints, tolerance);
  if (polylines.length === 0) return null;

  // Step 2+3: Find all closed rings (directly closed + chained)
  const closedRings = findClosedRings(polylines, tolerance);

  // DEBUG
  if (!window._lastPolygonAlgoLog || Date.now() - window._lastPolygonAlgoLog > 2000) {
    window._lastPolygonAlgoLog = Date.now();
    console.log("[POLYGON_DETECT] algo", {
      polylinesCount: polylines.length,
      polylineSizes: polylines.map(p => p.length),
      closedRingsCount: closedRings.length,
      closedRingSizes: closedRings.map(r => r.length),
    });
  }

  if (closedRings.length === 0) return null;

  // Step 4: Find the smallest closed ring containing mousePos
  const envelope = selectEnvelope(closedRings, mousePos);
  if (!envelope) return null;

  // Step 4b: Skip if envelope matches an existing POLYGON annotation
  const matchingExisting = findMatchingExistingPolygon(annotations, envelope);
  if (matchingExisting) {
    const cutContainingMouse = findCutContainingMouse(matchingExisting, mousePos);
    if (cutContainingMouse) {
      const innerEnvelope = selectEnvelopeInsideRegion(closedRings, mousePos, cutContainingMouse);
      if (innerEnvelope) {
        const innerCuts = findCuts(annotations, innerEnvelope, tolerance);
        return { outerRing: innerEnvelope, cuts: innerCuts };
      }
    }
    return null;
  }

  // Step 5: Find cuts
  const cuts = findCuts(annotations, envelope, tolerance);

  return { outerRing: envelope, cuts };
}

// ---------------------------------------------------------------------------
// Step 1: Extract polylines
// ---------------------------------------------------------------------------

function extractPolylines(annotations, drawingPoints, tolerance) {
  const polylines = [];

  for (const ann of annotations) {
    if (!ann.points || ann.points.length < 2) continue;

    if (ann.type === "POLYLINE") {
      const pts = ann.points.map((p) => ({ x: p.x, y: p.y }));
      // If closeLine flag is set, explicitly close the polyline
      if (ann.closeLine && pts.length >= 3) {
        pts.push({ x: pts[0].x, y: pts[0].y });
      }
      polylines.push(pts);
    } else if (ann.type === "POLYGON") {
      // Polygon outer ring — implicitly closed
      const ring = ann.points.map((p) => ({ x: p.x, y: p.y }));
      if (ring.length >= 3) {
        // Explicitly close
        ring.push({ x: ring[0].x, y: ring[0].y });
        polylines.push(ring);
      }
    }
  }

  // DrawingPoints as a polyline
  if (drawingPoints && drawingPoints.length >= 2) {
    polylines.push(drawingPoints.map((p) => ({ x: p.x, y: p.y })));
  }

  return polylines;
}

// ---------------------------------------------------------------------------
// Step 2+3: Find closed rings
// ---------------------------------------------------------------------------

/**
 * Find all closed rings by:
 * A) Detecting polylines that are already closed (start ≈ end)
 * B) Chaining open polylines end-to-end to form closed loops
 */
function findClosedRings(polylines, tolerance) {
  const tolSq = tolerance * tolerance;
  const closed = [];
  const open = [];

  // Separate closed vs open polylines
  for (const poly of polylines) {
    if (poly.length < 3) continue;
    const first = poly[0], last = poly[poly.length - 1];
    const dSq = (first.x - last.x) ** 2 + (first.y - last.y) ** 2;
    if (dSq <= tolSq) {
      // Already closed — ensure exact closure
      const ring = [...poly];
      ring[ring.length - 1] = { x: ring[0].x, y: ring[0].y };
      closed.push(ring);
    } else {
      open.push(poly);
    }
  }

  // Try chaining open polylines to form closed loops
  // Use DFS on the open polylines' endpoints
  if (open.length > 0 && open.length <= 50) {
    const chains = findChainedClosedLoops(open, tolSq);
    for (const chain of chains) {
      if (chain.length >= 4) closed.push(chain);
    }
  }

  return closed;
}

/**
 * Try to chain open polylines end-to-end to form closed loops.
 * Each open polyline has two endpoints (start, end).
 * We search for sequences where polyline_i.end ≈ polyline_j.start (or reversed).
 */
function findChainedClosedLoops(openPolylines, tolSq) {
  const n = openPolylines.length;
  const results = [];

  // Precompute endpoints
  const endpoints = openPolylines.map((poly) => ({
    start: poly[0],
    end: poly[poly.length - 1],
    pts: poly,
  }));

  function near(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= tolSq;
  }

  // DFS: try to build a chain starting from each polyline
  // A chain connects polylines end-to-start (possibly reversed)
  // and forms a closed loop when the last endpoint ≈ first startpoint
  const MAX_CHAIN = 10; // max polylines in a chain
  const seenKeys = new Set();

  function dfs(chainIndices, chainReversed, currentEnd) {
    // Check if we can close the loop back to the start of the first polyline
    if (chainIndices.length >= 2) {
      const firstPoly = endpoints[chainIndices[0]];
      const firstStart = chainReversed[0] ? firstPoly.end : firstPoly.start;
      if (near(currentEnd, firstStart)) {
        // Build the ring from the chain
        const key = normalizeChainKey(chainIndices, chainReversed);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const ring = buildRingFromChain(endpoints, chainIndices, chainReversed);
          if (ring) results.push(ring);
        }
      }
    }

    if (chainIndices.length >= MAX_CHAIN) return;

    // Try extending the chain with another polyline
    const usedSet = new Set(chainIndices);
    for (let i = 0; i < n; i++) {
      if (usedSet.has(i)) continue;
      const ep = endpoints[i];

      // Try normal orientation: currentEnd ≈ ep.start
      if (near(currentEnd, ep.start)) {
        chainIndices.push(i);
        chainReversed.push(false);
        dfs(chainIndices, chainReversed, ep.end);
        chainIndices.pop();
        chainReversed.pop();
      }

      // Try reversed orientation: currentEnd ≈ ep.end
      if (near(currentEnd, ep.end)) {
        chainIndices.push(i);
        chainReversed.push(true);
        dfs(chainIndices, chainReversed, ep.start);
        chainIndices.pop();
        chainReversed.pop();
      }
    }
  }

  for (let i = 0; i < n; i++) {
    // Start chain with polyline i in normal orientation
    dfs([i], [false], endpoints[i].end);
    // Start chain with polyline i in reversed orientation
    dfs([i], [true], endpoints[i].start);
  }

  return results;
}

/**
 * Build a closed ring from a chain of polylines.
 */
function buildRingFromChain(endpoints, indices, reversed) {
  const ring = [];
  for (let k = 0; k < indices.length; k++) {
    const ep = endpoints[indices[k]];
    let pts = ep.pts;
    if (reversed[k]) pts = [...pts].reverse();
    // Skip the first point of subsequent polylines (it overlaps with previous end)
    const startIdx = k === 0 ? 0 : 1;
    for (let j = startIdx; j < pts.length; j++) {
      ring.push({ x: pts[j].x, y: pts[j].y });
    }
  }
  // Close the ring
  if (ring.length >= 3) {
    ring.push({ x: ring[0].x, y: ring[0].y });
    return ring;
  }
  return null;
}

/**
 * Normalize chain key for deduplication (same cycle starting from different polyline).
 */
function normalizeChainKey(indices, reversed) {
  const n = indices.length;
  const entries = indices.map((idx, k) => `${idx}:${reversed[k] ? 'r' : 'f'}`);
  // Find all rotations and pick the lexicographically smallest
  let best = entries.join(",");
  for (let rot = 1; rot < n; rot++) {
    const rotated = [...entries.slice(rot), ...entries.slice(0, rot)].join(",");
    if (rotated < best) best = rotated;
  }
  // Also check reverse direction
  const revEntries = [...entries].reverse().map((e) => {
    const [idx, dir] = e.split(":");
    return `${idx}:${dir === "r" ? "f" : "r"}`;
  });
  for (let rot = 0; rot < n; rot++) {
    const rotated = [...revEntries.slice(rot), ...revEntries.slice(0, rot)].join(",");
    if (rotated < best) best = rotated;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Step 4: Select envelope (smallest closed ring containing mousePos)
// ---------------------------------------------------------------------------

function selectEnvelope(closedRings, mousePos) {
  let bestRing = null;
  let bestArea = Infinity;

  for (const ring of closedRings) {
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
// Step 5: Find cuts (existing closed annotations fully inside envelope)
// ---------------------------------------------------------------------------

function findCuts(annotations, envelope, tolerance) {
  const cuts = [];
  const envelopeArea = Math.abs(polygonArea(envelope));
  const tolSq = tolerance * tolerance;

  for (const ann of annotations) {
    if (!ann.points || ann.points.length < 3) continue;

    // Accept POLYGON or closed POLYLINE (closeLine flag, or first ≈ last point)
    let isClosed = ann.type === "POLYGON";
    if (ann.type === "POLYLINE") {
      if (ann.closeLine) {
        isClosed = true;
      } else {
        const first = ann.points[0], last = ann.points[ann.points.length - 1];
        if ((first.x - last.x) ** 2 + (first.y - last.y) ** 2 <= tolSq) isClosed = true;
      }
    }
    if (!isClosed) continue;

    const ring = ann.points.map((p) => ({ x: p.x, y: p.y }));

    // All points must be inside the envelope
    if (!ring.every((p) => pointInPolygon(p, envelope))) continue;

    // Must not be the same polygon as the envelope
    const ringArea = Math.abs(polygonArea(ring));
    if (envelopeArea > 0 && Math.abs(ringArea - envelopeArea) / envelopeArea < 0.01) continue;

    const closedRing = [...ring, { x: ring[0].x, y: ring[0].y }];
    cuts.push(closedRing);
  }

  return cuts;
}

// ---------------------------------------------------------------------------
// Step 4b helpers: existing polygon matching + cut detection
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

function selectEnvelopeInsideRegion(closedRings, mousePos, regionRing) {
  let bestRing = null;
  let bestArea = Infinity;

  for (const ring of closedRings) {
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

/**
 * Ray-casting point-in-polygon test.
 */
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

/**
 * Signed polygon area using the shoelace formula.
 */
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
