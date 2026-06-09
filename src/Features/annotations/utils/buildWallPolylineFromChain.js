import { expandRingWithOffsets } from "Features/geometry/utils/arcSampling";
import buildWallProfileFromChain from "Features/annotations/utils/buildWallProfileFromChain";

// Builds the polyline of a wall piece (bout de paroi) from a user-selected run
// of contour segments of a (sloped) POLYGON.
//
// `pointRefs` is the ordered chain of resolved contour points spanning the
// selection (pixel-space x/y, plus the per-vertex `offsetTop` = ramp ground
// height that useAnnotationsV2 derived from the guideLine slope). Arcs in the
// chain (square → circle → square triplets) are expanded so the wall follows
// the curve instead of collapsing onto its 2 chord segments — same handling as
// buildSlopeWallPolyline (issue #264).
//
// Profiles mirror "Parois de la pente":
//   - "STRAIGHT": plain rectangular wall, flat bottom (0) + constant `height`.
//   - "CONSTANT": wallTop = min(ground + height, maxHeight).
//   - "MAX":      wallTop = maxHeight (flat ceiling).
//
// Returns an ordered array [{ x, y, ground, wallTop }] (pixels + meters), or
// null when no wall can be built.

// 2 segments per sample-half → 4 samples ≈ 8 straight segments per arc.
const CONTOUR_ARC_SAMPLES = 4;

export default function buildWallPolylineFromChain({
  pointRefs,
  profileType,
  height,
  maxHeight,
}) {
  if (!Array.isArray(pointRefs) || pointRefs.length < 2) return null;

  const expanded = expandRingWithOffsets(pointRefs, CONTOUR_ARC_SAMPLES, false);

  const chain = expanded
    .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
    .map((p) => ({
      x: p.x,
      y: p.y,
      ground: Number.isFinite(p.offsetTop) ? p.offsetTop : 0,
    }));

  if (chain.length < 2) return null;

  return buildWallProfileFromChain(chain, { profileType, height, maxHeight });
}
