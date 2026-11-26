// Layer of the clipping box of a base map that is SEEN from the camera: the
// base map image hides what lies on its other side, so looking at its front
// face shows the front layer (0 → frontM along the normal), looking at its
// back face shows the back layer (−backM → 0). « Vectoriser » / « Rasteriser »
// work on that layer: what is visible on screen.
//
// clipping: { frontM, backM } (getBaseMapClipping3d; null = no limit).
// viewDotNormal: camera view direction · base map normal (≤ 0: the camera
// looks at the front face).
// → { side: "front" | "back", lower, upper }: signed distances to the base
// map plane, in metres.

// stand-in for "no limit" (the slice bounds must stay finite)
const UNLIMITED_DEPTH_M = 1e6;

export default function getVisibleClipLayerRange(clipping, viewDotNormal) {
  const side = viewDotNormal <= 0 ? "front" : "back";
  const stored = side === "front" ? clipping?.frontM : clipping?.backM;
  const depth = Number.isFinite(stored)
    ? Math.max(0, stored)
    : UNLIMITED_DEPTH_M;
  return side === "front"
    ? { side, lower: 0, upper: depth }
    : { side, lower: -depth, upper: 0 };
}
