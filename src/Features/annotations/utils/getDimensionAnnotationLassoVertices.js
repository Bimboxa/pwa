import getRulerSegments from "./getRulerSegments";
import { getRulerSegmentKeys, isZeroLabelOffset } from "./getRulerSegmentKey";

// Lasso hit-test vertices of the INK of a RULER / COTE annotation, in the
// same local pixel space as the resolved annotation.points: the ends of the
// offset dimension line and the centre of each value card. The measured
// points alone (getAnnotationVertices) miss what the user actually sees — the
// line sits `extensionOffset` away from them and the cards can be displaced
// (`rulerLabelOffsets`). Mirrors NodeRulerStatic / NodeCoteStatic.
//
// `meterByPx` is optional: without a scale the CM offsets and the metre card
// displacements cannot be resolved, so only the PX offset line is added.
export default function getDimensionAnnotationLassoVertices(
  annotation,
  { meterByPx } = {}
) {
  if (!annotation) return [];
  const type = annotation.type;
  if (type !== "RULER" && type !== "COTE") return [];

  const pts = (annotation.points || []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  if (pts.length < 2) return [];

  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const extensionOffset = annotation.extensionOffset ?? 8;
  const extensionOffsetUnit = annotation.extensionOffsetUnit ?? "PX";
  let offsetPx = extensionOffset;
  if (extensionOffsetUnit === "CM") {
    if (!hasScale) return [];
    offsetPx = (extensionOffset * 0.01) / meterByPx;
  }

  if (type === "COTE") {
    const [p1, p2] = pts;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return [];
    // Canonical perpendicular (90° CW in y-down screen coords).
    const ox = (-dy / length) * offsetPx;
    const oy = (dx / length) * offsetPx;
    const D1 = { x: p1.x + ox, y: p1.y + oy };
    const D2 = { x: p2.x + ox, y: p2.y + oy };
    // The 2D value sits at the dimension-line midpoint (coteLabelOffset is
    // 3D-only).
    return [D1, D2, { x: (D1.x + D2.x) / 2, y: (D1.y + D2.y) / 2 }];
  }

  // RULER: parallel offset chain + one card per segment, displaced by the
  // stored metres (local frame y-up, image y-down).
  const { segments, offsetPoints } = getRulerSegments({
    points: pts,
    meterByPx,
    offsetPx,
  });
  const verts = offsetPoints.map((p) => ({ x: p.x, y: p.y }));
  const labelOffsets = annotation.rulerLabelOffsets || {};
  const keys = getRulerSegmentKeys(pts);
  segments.forEach((seg, i) => {
    const v = labelOffsets[keys[i]];
    const displaced = hasScale && !isZeroLabelOffset(v);
    verts.push({
      x: seg.mid.x + (displaced ? (v.x || 0) / meterByPx : 0),
      y: seg.mid.y - (displaced ? (v.y || 0) / meterByPx : 0),
    });
  });
  return verts;
}
