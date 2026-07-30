import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import applyPhotoPlanHomography from "./applyPhotoPlanHomography";

// Map an annotation path (PIXEL-resolved typed points, the useAnnotationsV2
// shape) drawn on a photo into the photoPlan's metric frame (meters, y-up).
//
// S-C-S arcs are pre-expanded into straight segments (a homography bends
// circles into conics — the arc must be sampled BEFORE mapping), then each
// vertex goes through H (normalized photo coords in, meters out).
//
// Returns the mapped points array, or null when the input is unusable or ANY
// vertex lies on / beyond the horizon (the caller decides skip-vs-partial).

const ARC_SAMPLES = 12;

export default function mapPhotoPointsToPlane({
  H,
  points,
  imageSize,
  closeLine = false,
}) {
  if (!H || !Array.isArray(points) || points.length === 0) return null;
  const W = imageSize?.width;
  const Ht = imageSize?.height;
  if (!W || !Ht) return null;

  const expanded = expandArcsInPath(points, ARC_SAMPLES, closeLine);

  const out = [];
  for (const p of expanded) {
    const mapped = applyPhotoPlanHomography(H, {
      x: p.x / W,
      y: p.y / Ht,
    });
    if (!mapped) return null;
    const next = { x: mapped.x, y: mapped.y };
    if (p.id != null) next.id = p.id;
    out.push(next);
  }
  return out;
}
