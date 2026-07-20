// Computes the glued placement of a fixed-length opening segment along the
// nearest host POLYLINE/POLYGON edge (straight or S-C-S arc).
//
// The anchor endpoint (p1) follows the cursor's projection on the host; the
// segment extends along the wall toward p2 (direction toggled with the S key
// via `anchorEnd`). Endpoints magnetize to existing vertices lying on the
// host curve. Returns null when no host edge is within `hoverThresholdPx`
// (the caller then falls back to free placement).

import { buildHostCurve } from "./computeOpeningEndpointsFromHost";

const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

// Distance (px, image space) below which a vertex counts as lying ON the
// host curve and becomes an endpoint snap candidate.
const ON_CURVE_TOLERANCE_PX = 2;

// Collects hosting segments (straight + full S-C-S arcs) from the main
// contour of each candidate annotation.
function collectHostSegments(annotations) {
  const segments = [];

  for (const ann of annotations) {
    if (!["POLYLINE", "POLYGON"].includes(ann.type)) continue;
    if (ann.isOpening) continue;
    const pts = ann.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;

    const n = pts.length;
    const shouldClose = ann.closeLine || ann.type === "POLYGON";
    const limit = shouldClose ? n : n - 1;
    const getPt = (i) => pts[(i + n) % n];

    let i = 0;
    while (i < limit) {
      const p0 = getPt(i);
      const p1 = getPt(i + 1);

      // S-C-S pattern (arc through a single circle control point)
      if (typeOf(p0) === "square" && typeOf(p1) === "circle") {
        let j = i + 1;
        while (j < i + n && typeOf(getPt(j)) === "circle") j++;

        if (!shouldClose && j >= n) {
          segments.push({ ann, segIndex: i, A: p0, B: p1, arcControl: null });
          i++;
          continue;
        }

        const pNextSquare = getPt(j);

        if (j === i + 2) {
          segments.push({
            ann,
            segIndex: i,
            A: p0,
            B: pNextSquare,
            arcControl: p1,
          });
          i += 2;
          continue;
        }

        // Multiple circles — treat as linear pieces (same fallback as
        // getBestSnap).
        let k = i;
        while (k < j) {
          segments.push({
            ann,
            segIndex: k,
            A: getPt(k),
            B: getPt(k + 1),
            arcControl: null,
          });
          k++;
        }
        i = j;
        continue;
      }

      segments.push({ ann, segIndex: i, A: p0, B: p1, arcControl: null });
      i++;
    }
  }

  return segments;
}

// Every resolved point (with a db id) of every annotation — including other
// openings' endpoints and cut rings — is an endpoint snap candidate.
function collectVertexCandidates(annotations) {
  const vertices = [];
  for (const ann of annotations) {
    if (Array.isArray(ann.points)) {
      for (const pt of ann.points) {
        if (pt?.id != null) vertices.push(pt);
      }
    }
    if (Array.isArray(ann.cuts)) {
      for (const cut of ann.cuts) {
        for (const pt of cut?.points ?? []) {
          if (pt?.id != null) vertices.push(pt);
        }
      }
    }
  }
  return vertices;
}

/**
 * @param {Object} args
 * @param {{x,y}} args.cursorPx - cursor in image space
 * @param {Array} args.annotations - resolved annotations (px points with ids)
 * @param {number} args.openingLengthPx - opening width along the wall, px
 * @param {number} args.hoverThresholdPx - max cursor↔host distance (10cm plan)
 * @param {number} args.vertexSnapPx - endpoint↔vertex magnetism threshold
 * @param {"start"|"end"} [args.anchorEnd] - which endpoint the mouse holds (S key)
 * @returns {null | {
 *   p1: {x,y}, p2: {x,y},
 *   hostAnnotationId: string, hostSegmentIndex: number,
 *   segStartId: string, segEndId: string,
 *   segStart: {x,y}, segEnd: {x,y},
 *   arcControlId: string|null, arcControl: {x,y}|null,
 *   hostDistancePx: number, fits: boolean,
 *   snapped: null | { which: "p1"|"p2", x: number, y: number, pointId: string },
 * }}
 */
export default function computeOpeningSegmentPlacement({
  cursorPx,
  annotations,
  openingLengthPx,
  hoverThresholdPx,
  vertexSnapPx,
  anchorEnd = "start",
}) {
  if (!cursorPx || !Array.isArray(annotations) || !(openingLengthPx > 0)) {
    return null;
  }

  const segments = collectHostSegments(annotations);
  if (!segments.length) return null;

  // 1. Nearest hosting segment
  let best = null;
  for (const seg of segments) {
    const curve = buildHostCurve(seg.A, seg.B, seg.arcControl);
    if (curve.len === 0) continue;
    const proj = curve.project(cursorPx);
    if (!best || proj.distance < best.proj.distance) {
      best = { seg, curve, proj };
    }
  }
  if (!best || best.proj.distance > hoverThresholdPx) return null;

  const { seg, curve, proj } = best;
  const L = openingLengthPx;

  const base = {
    hostAnnotationId: seg.ann.id,
    hostSegmentIndex: seg.segIndex,
    segStartId: seg.A.id,
    segEndId: seg.B.id,
    segStart: { x: seg.A.x, y: seg.A.y },
    segEnd: { x: seg.B.x, y: seg.B.y },
    arcControlId: seg.arcControl?.id ?? null,
    arcControl: seg.arcControl
      ? { x: seg.arcControl.x, y: seg.arcControl.y }
      : null,
  };

  // 2. Opening longer than the hosting segment — invalid preview
  if (curve.len < L) {
    return {
      ...base,
      p1: { x: seg.A.x, y: seg.A.y },
      p2: { x: seg.B.x, y: seg.B.y },
      hostDistancePx: curve.len / 2,
      fits: false,
      snapped: null,
    };
  }

  // 3. Anchor endpoint at the cursor projection, opening extending along the
  // wall (direction toggled by the S key), clamped against corners.
  const dir = anchorEnd === "start" ? 1 : -1;
  let sAnchor =
    dir === 1
      ? Math.max(0, Math.min(curve.len - L, proj.s))
      : Math.max(L, Math.min(curve.len, proj.s));
  let sOther = sAnchor + dir * L;

  // 4. Endpoint ↔ vertex magnetism: vertices lying on the host curve pull the
  // nearest opening endpoint (smallest shift wins, opening stays in-segment).
  let snapped = null;
  const vertices = collectVertexCandidates(annotations);
  let bestShift = null;

  for (const v of vertices) {
    const vProj = curve.project(v);
    if (vProj.distance > ON_CURVE_TOLERANCE_PX) continue;

    for (const [endpointS, which] of [
      [sAnchor, "p1"],
      [sOther, "p2"],
    ]) {
      const shift = vProj.s - endpointS;
      if (Math.abs(shift) > vertexSnapPx) continue;
      const newLow = Math.min(sAnchor, sOther) + shift;
      const newHigh = Math.max(sAnchor, sOther) + shift;
      if (newLow < -1e-6 || newHigh > curve.len + 1e-6) continue;
      if (bestShift === null || Math.abs(shift) < Math.abs(bestShift.shift)) {
        bestShift = { shift, which, pointId: v.id, s: vProj.s };
      }
    }
  }

  if (bestShift) {
    sAnchor += bestShift.shift;
    sOther += bestShift.shift;
    const snapPos = curve.pointAt(bestShift.s);
    snapped = {
      which: bestShift.which,
      x: snapPos.x,
      y: snapPos.y,
      pointId: bestShift.pointId,
    };
  }

  return {
    ...base,
    p1: curve.pointAt(sAnchor),
    p2: curve.pointAt(sOther),
    hostDistancePx: (sAnchor + sOther) / 2,
    fits: true,
    snapped,
  };
}
