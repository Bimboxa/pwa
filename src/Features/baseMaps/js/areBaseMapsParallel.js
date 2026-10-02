import getBaseMapTransform from "./getBaseMapTransform";

// Two base maps are "parallel" when their planes share the same normal, same
// facing: every HORIZONTAL base map with every other (the levels of a
// building), a VERTICAL one only with the VERTICAL ones standing at the same
// angle (never a section with a plan). The altitude / offset along the normal
// is NOT compared: parallel base maps can be overlaid in the 2D editor by
// projection along the normal.
//
// Opposite facings (a VERTICAL base map turned by 180°) are rejected: the
// overlay would be seen mirrored.

const ANGLE_EPS_DEG = 0.1;
const MIN_DOT = Math.cos((ANGLE_EPS_DEG * Math.PI) / 180);

// Unit normal of the base map plane in world coords (local +Z).
export function getBaseMapNormal(baseMap) {
  const { orientation, angleDeg } = getBaseMapTransform(baseMap);
  if (orientation !== "VERTICAL") return { x: 0, y: 1, z: 0 };
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.sin(a), y: 0, z: Math.cos(a) };
}

export default function areBaseMapsParallel(baseMapA, baseMapB) {
  if (!baseMapA || !baseMapB) return false;
  const a = getBaseMapNormal(baseMapA);
  const b = getBaseMapNormal(baseMapB);
  return a.x * b.x + a.y * b.y + a.z * b.z >= MIN_DOT;
}
