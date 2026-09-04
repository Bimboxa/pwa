import { buildHostCurve } from "Features/mapEditor/utils/computeOpeningEndpointsFromHost";
import computeOpeningSegmentPlacement from "Features/mapEditor/utils/computeOpeningSegmentPlacement";
import getOpeningHostOffsetPx from "Features/mapEditor/utils/getOpeningHostOffsetPx";

// Plan distance (m) within which a drag keeps the opening on its current
// host segment instead of jumping to the nearest one.
const STICKY_REACH_M = 0.5;

// Pure geometry for sliding a glued opening ALONG its host: given the
// opening (2 resolved px points), its host (resolved px points) and a target
// centre position, pick the hosting segment and return the constrained
// placement of the opening on that segment's glue curve (STRIP median /
// polyline axis), clamped so the opening stays inside the segment.
//
// `preferredAnchor` ({ startId, endId, arcControlId } — the rel's current
// anchor) keeps the opening on ITS segment while the target stays within
// reach of it (STICKY_REACH_M + the median offset): near a corner the
// nearest-segment rule would otherwise flip the opening onto the adjacent
// wall on every frame. Dragging clearly away still moves it to the nearest
// segment.
//
// Shared by the live drag (constrained deltaPos each frame) and the commit
// (anchor rewrite), so preview and persisted position agree.
//
// @returns {null | {
//   anchor: { hostSegmentStartPointId, hostSegmentEndPointId,
//             hostArcControlPointId, hostDistancePx },
//   p1: {x,y}, p2: {x,y}, delta: {x,y}   // delta = new p1 − current p1
// }}
export default function getOpeningHostSlide({
  opening,
  host,
  targetCenter,
  meterByPx,
  notchPointIds = [],
  preferredAnchor = null,
}) {
  const pts = opening?.points;
  if (!pts || pts.length !== 2 || !host?.points?.length) return null;
  if (!(meterByPx > 0)) return null;

  const widthM = Number(opening.width);
  const openingLengthPx =
    widthM > 0
      ? widthM / meterByPx
      : Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  if (!(openingLengthPx > 0)) return null;

  // Project on the RESTORED contour (the rel's own notch points dropped), as
  // the reflow service does, so a carved polygon host still reads as a wall.
  const notchSet = new Set(notchPointIds);
  const hostPoints = host.points.filter((p) => !notchSet.has(p?.id));
  if (hostPoints.length < 2) return null;

  const offsetPx = getOpeningHostOffsetPx(host, meterByPx);
  let placement = null;

  // Sticky segment: the anchored one, while the target is within reach.
  if (preferredAnchor?.startId && preferredAnchor?.endId) {
    const byId = new Map(hostPoints.map((p) => [p.id, p]));
    const A = byId.get(preferredAnchor.startId);
    const B = byId.get(preferredAnchor.endId);
    const C = preferredAnchor.arcControlId
      ? byId.get(preferredAnchor.arcControlId)
      : null;
    if (A && B) {
      const c = buildHostCurve(A, B, C, offsetPx);
      const reach = STICKY_REACH_M / meterByPx + Math.abs(offsetPx);
      if (c.len > 0 && c.project(targetCenter).distance <= reach) {
        placement = {
          segStartId: A.id,
          segEndId: B.id,
          segStart: A,
          segEnd: B,
          arcControlId: C?.id ?? null,
          arcControl: C ?? null,
        };
      }
    }
  }

  if (!placement) {
    placement = computeOpeningSegmentPlacement({
      cursorPx: targetCenter,
      annotations: [{ ...host, points: hostPoints, isOpening: false }],
      openingLengthPx,
      hoverThresholdPx: Infinity,
      vertexSnapPx: 0,
      anchorEnd: "start",
      meterByPx,
    });
  }
  if (!placement) return null;

  const curve = buildHostCurve(
    placement.segStart,
    placement.segEnd,
    placement.arcControl,
    offsetPx
  );
  if (!(curve.len > 0)) return null;

  // Centre abscissa, clamped so both jambs stay on the segment (an opening
  // longer than the segment sits centred on it).
  const L = Math.min(openingLengthPx, curve.len);
  const s = Math.max(
    L / 2,
    Math.min(curve.len - L / 2, curve.project(targetCenter).s)
  );
  const p1 = curve.pointAt(s - L / 2);
  const p2 = curve.pointAt(s + L / 2);

  return {
    anchor: {
      hostSegmentStartPointId: placement.segStartId,
      hostSegmentEndPointId: placement.segEndId,
      hostArcControlPointId: placement.arcControlId ?? null,
      hostDistancePx: s,
    },
    p1,
    p2,
    delta: { x: p1.x - pts[0].x, y: p1.y - pts[0].y },
  };
}
