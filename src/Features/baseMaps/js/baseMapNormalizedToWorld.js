import baseMapLocalToWorld from "./baseMapLocalToWorld";
import getBaseMapTransform from "./getBaseMapTransform";

// Forward of `worldToBaseMapNormalized`.
//
// Project a normalized baseMap point ({x, y} in [0..1] against
// `baseMap.getImageSize()`) into the 3D world frame, applying the baseMap's
// 3D placement (orientation + angleDeg + position).
//
// Returns a `THREE.Vector3` in world coords, or `null` if the baseMap lacks a
// usable size or `meterByPx`.
//
// `options.transform` / `options.meterByPx` override the baseMap's own values
// (used by the recalage solver to probe alternative placements/scales).
export default function baseMapNormalizedToWorld(rel, baseMap, options = {}) {
  if (!baseMap || !rel) return null;

  const imageSize =
    typeof baseMap.getImageSize === "function"
      ? baseMap.getImageSize()
      : baseMap.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const meterByPx =
    options.meterByPx ??
    (typeof baseMap.getMeterByPx === "function"
      ? baseMap.getMeterByPx()
      : baseMap.meterByPx);
  if (!meterByPx) return null;

  const transform = options.transform ?? getBaseMapTransform(baseMap);

  const { width: W, height: H } = imageSize;
  const px = rel.x * W;
  const py = rel.y * H;

  // Inverse of `worldToBaseMapNormalized`'s pixel mapping:
  //   x_local = (px - W/2)  * meterByPx
  //   y_local = -(py - H/2) * meterByPx
  const local = {
    x: (px - W / 2) * meterByPx,
    y: -(py - H / 2) * meterByPx,
  };

  return baseMapLocalToWorld(local, transform);
}
