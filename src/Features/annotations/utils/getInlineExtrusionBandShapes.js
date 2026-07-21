import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import getInlineExtrusionSetup from "Features/annotations/utils/getInlineExtrusionSetup";

const GUIDE_ARC_SAMPLES = 6;

// 2D plan footprint of the inline "Extrusion" (POLYLINE + profileLines): a
// thick band along the guide showing the swept profile's transverse extents
// (same registration as the 3D sweep — u offsets from the crossed segment's
// extremity, mapped onto the right-of-tangent normal). One quad per visible
// guide segment, in PIXEL space, ready to render as a filled band.
//
// Input: RESOLVED annotation (points + profileLines in px, heights meters).
// Returns [{ points: [{x, y}×4] }] or null.
export default function getInlineExtrusionBandShapes(annotation, meterByPx) {
  if (annotation?.type !== "POLYLINE") return null;
  const line = (annotation.profileLines || []).find(
    (l) => (l?.points?.length ?? 0) >= 2
  );
  if (!line) return null;

  const guide = expandArcsInPath(
    (annotation.points || []).filter(
      (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    ),
    GUIDE_ARC_SAMPLES,
    !!annotation.closeLine
  );
  if (guide.length < 2) return null;

  const setup = getInlineExtrusionSetup({
    guidePoints: guide,
    profilePoints: line.points,
    meterByPx: meterByPx || 1,
    closeLine: !!annotation.closeLine,
  });
  if (!setup) return null;
  const { uMin, uMax } = setup.extents;
  if (!(uMax - uMin > 1e-6)) return null;

  const hidden = new Set(annotation.hiddenSegmentsIdx || []);
  const n = guide.length;
  const segCount = annotation.closeLine ? n : n - 1;
  const shapes = [];
  for (let i = 0; i < segCount; i += 1) {
    if (hidden.has(i)) continue;
    const a = guide[i];
    const b = guide[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const nx = dy / len;
    const ny = -dx / len;
    shapes.push({
      points: [
        { x: a.x + nx * uMin, y: a.y + ny * uMin },
        { x: b.x + nx * uMin, y: b.y + ny * uMin },
        { x: b.x + nx * uMax, y: b.y + ny * uMax },
        { x: a.x + nx * uMax, y: a.y + ny * uMax },
      ],
    });
  }
  return shapes.length > 0 ? shapes : null;
}
