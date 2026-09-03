import { Vector3 } from "three";

import baseMapNormalizedToWorld from "Features/baseMaps/js/baseMapNormalizedToWorld";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import getPolylinePointsFromRectangle from "Features/geometry/utils/getPolylinePointsFromRectangle";

// Minimum rectangle side, in image pixels — under this the two clicks are
// degenerate and no rectangle is produced.
const MIN_SIDE_PX = 1;

// Rectangle from two diagonal 3D points on a base map plane. Both points are
// projected to the image pixel space, the four corners are built axis-aligned
// in the image frame (exactly like the 2D RECTANGLE commit), then mapped back
// to world. All four corners stay on the ANCHOR's plane — the anchor's
// off-plane lift (e.g. an image raised by drawingOffset) is reapplied, so the
// preview and the committed offsets match where the user clicked.
//
// Returns [Vector3 x4] in A, B, C, D order, or null when degenerate or when
// the baseMap lacks a usable size / meterByPx.
export default function computeRectangleCorners(
  anchorWorld,
  cursorWorld,
  baseMap
) {
  if (!anchorWorld || !cursorWorld || !baseMap) return null;

  const imageSize =
    typeof baseMap.getImageSize === "function"
      ? baseMap.getImageSize()
      : baseMap.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const relA = worldToBaseMapNormalized(anchorWorld, baseMap);
  const relC = worldToBaseMapNormalized(cursorWorld, baseMap);
  if (!relA || !relC) return null;

  const { width: W, height: H } = imageSize;
  const a = { x: relA.x * W, y: relA.y * H };
  const c = { x: relC.x * W, y: relC.y * H };
  if (Math.abs(a.x - c.x) < MIN_SIDE_PX || Math.abs(a.y - c.y) < MIN_SIDE_PX)
    return null;

  const cornersPx = getPolylinePointsFromRectangle([a, c], 0);

  const anchorOnPlane = baseMapNormalizedToWorld(
    { x: relA.x, y: relA.y },
    baseMap
  );
  if (!anchorOnPlane) return null;
  const lift = new Vector3(anchorWorld.x, anchorWorld.y, anchorWorld.z).sub(
    anchorOnPlane
  );

  const corners = [];
  for (const p of cornersPx) {
    const world = baseMapNormalizedToWorld({ x: p.x / W, y: p.y / H }, baseMap);
    if (!world) return null;
    corners.push(world.add(lift));
  }
  return corners;
}
