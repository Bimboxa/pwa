import offsetPolylineParallel from "Features/geometry/utils/offsetPolylineParallel";
import getCoteDisplayValue from "./getCoteDisplayValue";

// Pure geometry + formatting for a RULER (dimension chain). Dependency free
// beyond the two helpers above (plain {x, y} objects) so it can be replayed in
// node.
//
// `points` are the RESOLVED pixel points of the annotation. The alignment line
// is the true PARALLEL offset of the polyline (offsetPolylineParallel): each of
// its segments is parallel to its source segment and the joints are mitered, so
// the chain stays continuous across non-collinear segments without skewing.
// `offsetPx` is signed: its sign picks the side the cotes sit on.
//
// Each segment's value is measured between the ORIGINAL points, never on the
// offset line (same rule as NodeCoteStatic).
export default function getRulerSegments({
  points,
  meterByPx,
  unit = "CM",
  decimals = 0,
  showUnitLabel = true,
  offsetPx = 0,
}) {
  const pts = (points || []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  if (pts.length < 2) return { segments: [], offsetPoints: [], totalMeters: 0 };

  const offsetPoints = offsetPolylineParallel(pts, offsetPx);

  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const segments = [];
  let totalMeters = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const P1 = pts[i];
    const P2 = pts[i + 1];
    const D1 = offsetPoints[i];
    const D2 = offsetPoints[i + 1];

    // Vertical delta between endpoints (meters) — non-zero only for points
    // carrying an offsetBottom; Math.hypot(x, 0) === |x| so pure-2D rulers are
    // unaffected.
    const deltaZMeters = (P2.offsetBottom ?? 0) - (P1.offsetBottom ?? 0);
    const pixelDistance = Math.hypot(P2.x - P1.x, P2.y - P1.y);
    const meters = hasScale
      ? Math.hypot(pixelDistance * meterByPx, deltaZMeters || 0)
      : null;
    if (meters != null) totalMeters += meters;

    segments.push({
      index: i,
      startPointId: P1.id,
      endPointId: P2.id,
      P1,
      P2,
      D1,
      D2,
      mid: { x: (D1.x + D2.x) / 2, y: (D1.y + D2.y) / 2 },
      pixelDistance,
      meters,
      // Angle of the MEASURED segment (the offset chain is parallel to it only
      // when the polyline is straight, but the label must read along the
      // segment it describes).
      angleDeg: (Math.atan2(P2.y - P1.y, P2.x - P1.x) * 180) / Math.PI,
      text: getCoteDisplayValue({
        p1: P1,
        p2: P2,
        meterByPx,
        unit,
        decimals,
        showUnitLabel,
        deltaZMeters,
      }),
    });
  }

  return {
    segments,
    offsetPoints,
    totalMeters,
    totalText: formatTotal({ totalMeters, hasScale, unit, decimals, showUnitLabel }),
  };
}

// Same unit/decimals/suffix rules as getCoteDisplayValue, applied to an
// already-summed length in meters (the total of a chain is a sum of segment
// lengths, not the distance between the two extremities).
const UNIT_FACTORS_FROM_METERS = { MM: 1000, CM: 100, M: 1 };
const UNIT_SUFFIXES = { MM: "mm", CM: "cm", M: "m" };

function formatTotal({ totalMeters, hasScale, unit, decimals, showUnitLabel }) {
  if (!hasScale) return "—";
  const factor = UNIT_FACTORS_FROM_METERS[unit] ?? UNIT_FACTORS_FROM_METERS.CM;
  const safeDecimals = Math.max(0, Math.min(6, Number(decimals) || 0));
  const formatted = (totalMeters * factor).toFixed(safeDecimals);
  if (!showUnitLabel) return formatted;
  const suffix = UNIT_SUFFIXES[unit] ?? "";
  return suffix ? `${formatted} ${suffix}` : formatted;
}
