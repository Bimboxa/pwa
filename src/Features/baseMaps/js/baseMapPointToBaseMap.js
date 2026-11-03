import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld.js";
import worldToBaseMapNormalized from "./worldToBaseMapNormalized.js";
import { getBaseMapNormal } from "./areBaseMapsParallel.js";

// Re-expresses a point of one base map in the frame of another one, through
// both 3D placements (orientation + angleDeg + position + meterByPx):
//
//   source normalized (+ altitude along the source normal, metres)
//     -> world -> target normalized + offset along the target normal
//
// `rel` is `{x, y}` normalized in [0..1] against the source reference size
// (the db.points space); `altitude` lifts the point off the source plane
// (an annotation's offsetZ + vertex offset). Returns `{x, y, offset}` — the
// same shape as worldToBaseMapNormalized — or null when a base map lacks a
// usable size or `meterByPx`.
//
// Works for any pair of base maps: between two parallel plans the altitude
// becomes the offset (shifted by their difference of level); from a VERTICAL
// elevation to a HORIZONTAL plan the drawn height lands in `offset` and the
// plan point on the trace of the wall.
export default function baseMapPointToBaseMap(
  rel,
  source,
  target,
  { altitude = 0 } = {}
) {
  const world = baseMapNormalizedToWorld(rel, source);
  if (!world) return null;
  if (altitude) {
    const n = getBaseMapNormal(source);
    world.x += n.x * altitude;
    world.y += n.y * altitude;
    world.z += n.z * altitude;
  }
  return worldToBaseMapNormalized(world, target);
}
