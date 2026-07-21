import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import getInlineExtrusionSetup from "Features/annotations/utils/getInlineExtrusionSetup";

const GUIDE_ARC_SAMPLES = 6;

// Metrics of the inline "Extrusion" band (POLYLINE + profileLines): the plan
// projection of the swept profile is rendered as ONE thick stroke along the
// guide — offset to the CENTER of the profile's transverse extents, with the
// extents' width. Same registration as the 3D sweep (u offsets from the
// crossed segment's extremity, right-of-tangent normal).
//
// Input: RESOLVED annotation (points + profileLines in px, heights meters).
// Returns { offset, width } in image px (offset along the right-of-tangent
// normal, matching offsetPointsAlongNormals), or null.
export default function getInlineExtrusionBandMetrics(annotation, meterByPx) {
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
  const width = uMax - uMin;
  if (!(width > 1e-6)) return null;

  return { offset: (uMin + uMax) / 2, width };
}
