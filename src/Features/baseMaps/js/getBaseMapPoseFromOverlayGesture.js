import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld";
import getBaseMapTransform from "./getBaseMapTransform";

// 3D placement patch of a base map (`source`) moved / turned in the 2D editor
// while overlaid on a parallel base map (`host`).
//
// The gesture is expressed in HOST pixels:
//   - `centerPx` -> `nextCenterPx`: where the centre of the source image sat,
//     and where it sits now;
//   - `deltaDeg`: rotation about that centre, SVG convention (clockwise on
//     screen, y down).
//
// Returns `{ position, angleDeg }` (same contract as the 3D move / rotate
// tools), or null when the host cannot be projected.
//
// - The translation is a world DELTA inside the host plane, so the source
//   keeps its own altitude / offset along the normal.
// - A clockwise turn on the plan is a NEGATIVE rotation about world +Y
//   (HORIZONTAL: image x = world +X, image y = world +Z). A VERTICAL base map
//   cannot turn inside its plane (`angleDeg` spins it about the vertical
//   axis): its `deltaDeg` is ignored.

function getSize(baseMap) {
  return typeof baseMap?.getImageSize === "function"
    ? baseMap.getImageSize()
    : baseMap?.image?.imageSize;
}

// (-180, 180]
function normalizeDeg(deg) {
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

export default function getBaseMapPoseFromOverlayGesture({
  source,
  host,
  centerPx,
  nextCenterPx,
  deltaDeg = 0,
}) {
  const hostSize = getSize(host);
  if (!hostSize?.width || !hostSize?.height) return null;

  const toWorld = (px) =>
    baseMapNormalizedToWorld(
      { x: px.x / hostSize.width, y: px.y / hostSize.height },
      host
    );
  const from = toWorld(centerPx);
  const to = toWorld(nextCenterPx);
  if (!from || !to) return null;

  const { orientation, angleDeg, position } = getBaseMapTransform(source);

  return {
    position: {
      x: position.x + (to.x - from.x),
      y: position.y + (to.y - from.y),
      z: position.z + (to.z - from.z),
    },
    angleDeg:
      orientation === "VERTICAL" ? angleDeg : normalizeDeg(angleDeg - deltaDeg),
  };
}
