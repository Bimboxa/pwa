/**
 * Find reentrant angles where polyline vertices sit on polygon boundaries.
 *
 * A reentrant angle is one where the polyline "bites into" the polygon surface,
 * i.e. the angle between two polyline segments at a shared vertex is acute
 * relative to the polygon interior.
 *
 * A vertex is skipped (no reentrant angle) when it lies on a curve — it is an
 * arc (S-C-S) control point, or one of its two segments is an arc chord (its
 * far endpoint is an arc control point) — or when one of the two segments
 * forming the angle is shorter than `minSegmentLengthPx` (a small décrochage).
 *
 * @param {Object} params
 * @param {Array} params.polylines - [{ id, points: [{x,y,id,type?}...], height, closeLine }] in pixel coords
 * @param {Array} params.polygons  - [{ id, points: [{x,y,id}...], cuts: [{points}...] }] in pixel coords
 * @param {number} [params.angleThreshold=160] - max angle (degrees) to consider reentrant
 * @param {number} [params.epsilon=2] - tolerance in pixels for point-on-segment detection
 * @param {number} [params.minSegmentLengthPx=0] - skip the angle when either of
 *   its two segments is shorter than this (0 disables the check)
 * @returns {Array<{ x, y, pointId, polylineIds: string[], height: number }>}
 */
export default function findReentrantAngles({
  polylines,
  polygons,
  angleThreshold = 160,
  epsilon = 2,
  minSegmentLengthPx = 0,
}) {
  if (!polylines?.length || !polygons?.length) return [];

  // 1. Build polygon edge lists (outer ring + cuts)
  const polygonEdges = polygons.map((polygon) => {
    const edges = buildEdges(polygon.points);
    if (polygon.cuts) {
      for (const cut of polygon.cuts) {
        if (cut.points?.length >= 3) {
          edges.push(...buildEdges(cut.points));
        }
      }
    }
    return { polygon, edges };
  });

  // 2. Collect all polyline vertices with their adjacent segment directions
  // Key: rounded coordinate string, Value: { x, y, pointId, segments: [{dx,dy,polylineId}], heights: [] }
  const vertexMap = new Map();

  for (const polyline of polylines) {
    const pts = polyline.points;
    if (!pts || pts.length < 2) continue;

    const n = pts.length;
    const isClosed = polyline.closeLine;

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const key = coordKey(p, epsilon);

      if (!vertexMap.has(key)) {
        vertexMap.set(key, {
          x: p.x,
          y: p.y,
          pointId: p.id,
          segments: [],
          heights: [],
          // The vertex sits ON a curve when it is itself an arc control point.
          isCircle: p.type === "circle",
        });
      }

      const entry = vertexMap.get(key);
      if (p.type === "circle") entry.isCircle = true;
      if (polyline.height != null) {
        entry.heights.push(polyline.height);
      }

      // Previous segment direction (from vertex toward previous point).
      // `toCircle` marks an arc chord (its far endpoint is an arc control
      // point) and `len` its pixel length (for the small-décrochage filter).
      const prevIdx = isClosed ? (i - 1 + n) % n : i - 1;
      if (prevIdx >= 0 && prevIdx !== i) {
        const prev = pts[prevIdx];
        const dx = prev.x - p.x;
        const dy = prev.y - p.y;
        entry.segments.push({
          dx,
          dy,
          len: Math.hypot(dx, dy),
          toCircle: prev.type === "circle",
          polylineId: polyline.id,
        });
      }

      // Next segment direction (from vertex toward next point)
      const nextIdx = isClosed ? (i + 1) % n : i + 1;
      if (nextIdx < n && nextIdx !== i) {
        const next = pts[nextIdx];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        entry.segments.push({
          dx,
          dy,
          len: Math.hypot(dx, dy),
          toCircle: next.type === "circle",
          polylineId: polyline.id,
        });
      }
    }
  }

  // 3. For each vertex, check if it lies on a polygon boundary
  const results = [];

  for (const [, vertex] of vertexMap) {
    if (vertex.segments.length < 2) continue;

    // Find which polygon this vertex touches
    let touchedPolygon = null;
    for (const { polygon, edges } of polygonEdges) {
      if (isPointOnEdges(vertex, edges, epsilon)) {
        touchedPolygon = polygon;
        break;
      }
    }
    if (!touchedPolygon) continue;

    // A vertex that is itself an arc control point sits on a curve: the
    // "angle" there is the arc's chord bend, not a real reentrant corner.
    if (vertex.isCircle) continue;

    // 4. Check all pairs of segments for reentrant angles
    const segs = vertex.segments;
    const polylineIds = new Set();

    let isReentrant = false;

    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        // On a curve: at least one segment is an arc chord (its far endpoint
        // is an arc control point). The chord bend is not a real corner.
        if (segs[i].toCircle || segs[j].toCircle) continue;

        // Small décrochage: one connecting segment is shorter than the
        // threshold — too small to warrant a reentrant angle.
        if (
          minSegmentLengthPx > 0 &&
          (segs[i].len < minSegmentLengthPx || segs[j].len < minSegmentLengthPx)
        ) {
          continue;
        }

        const angleDeg = angleBetween(segs[i], segs[j]);
        if (angleDeg >= angleThreshold) continue;

        // Check if the angle faces into the polygon
        const bisector = getBisector(segs[i], segs[j]);
        const testPoint = {
          x: vertex.x + bisector.dx * epsilon * 2,
          y: vertex.y + bisector.dy * epsilon * 2,
        };

        if (isPointInsidePolygonWithCuts(testPoint, touchedPolygon)) {
          isReentrant = true;
          polylineIds.add(segs[i].polylineId);
          polylineIds.add(segs[j].polylineId);
        }
      }
    }

    if (isReentrant) {
      results.push({
        x: vertex.x,
        y: vertex.y,
        pointId: vertex.pointId,
        polylineIds: [...polylineIds],
        height: vertex.heights[0] ?? null,
      });
    }
  }

  return results;
}

// --- Helpers ---

function buildEdges(points) {
  const edges = [];
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    edges.push([points[i], points[j]]);
  }
  return edges;
}

function coordKey(p, epsilon) {
  const precision = Math.max(1, Math.round(1 / epsilon));
  return `${Math.round(p.x * precision)}:${Math.round(p.y * precision)}`;
}

function isPointOnEdges(p, edges, epsilon) {
  for (const [a, b] of edges) {
    if (pointOnSegment(p, a, b, epsilon)) return true;
  }
  return false;
}

/**
 * Check if point p is on segment [p1, p2] with tolerance.
 */
function pointOnSegment(p, p1, p2, epsilon) {
  const cross = Math.abs(
    (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x)
  );
  const lenSq = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
  const len = Math.sqrt(lenSq);

  // Distance from point to line must be within epsilon
  if (len > 0 && cross / len > epsilon) return false;

  // Point must be within the segment bounds (with epsilon tolerance)
  const dot = (p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y);
  return dot >= -epsilon * len && dot <= lenSq + epsilon * len;
}

/**
 * Angle (in degrees) between two direction vectors.
 */
function angleBetween(v1, v2) {
  const len1 = Math.sqrt(v1.dx * v1.dx + v1.dy * v1.dy);
  const len2 = Math.sqrt(v2.dx * v2.dx + v2.dy * v2.dy);
  if (len1 === 0 || len2 === 0) return 180;

  const dot = (v1.dx * v2.dx + v1.dy * v2.dy) / (len1 * len2);
  const clamped = Math.max(-1, Math.min(1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * Normalized bisector of two direction vectors.
 */
function getBisector(v1, v2) {
  const len1 = Math.sqrt(v1.dx * v1.dx + v1.dy * v1.dy);
  const len2 = Math.sqrt(v2.dx * v2.dx + v2.dy * v2.dy);
  if (len1 === 0 || len2 === 0) return { dx: 0, dy: 0 };

  const n1x = v1.dx / len1;
  const n1y = v1.dy / len1;
  const n2x = v2.dx / len2;
  const n2y = v2.dy / len2;

  const bx = n1x + n2x;
  const by = n1y + n2y;
  const bLen = Math.sqrt(bx * bx + by * by);

  if (bLen === 0) return { dx: -n1y, dy: n1x };
  return { dx: bx / bLen, dy: by / bLen };
}

/**
 * Check if a point is inside a polygon, accounting for cuts (holes).
 * A point must be inside the outer ring AND outside all cuts.
 */
function isPointInsidePolygonWithCuts(point, polygon) {
  if (!isPointInPolygon(point, polygon.points)) return false;
  if (polygon.cuts) {
    for (const cut of polygon.cuts) {
      if (cut.points?.length >= 3 && isPointInPolygon(point, cut.points)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Ray-casting point-in-polygon test.
 */
function isPointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}
