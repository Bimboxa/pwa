import { Vector3 } from "three";

import transformCutLinePoints from "../utils/transformCutLinePoints";

// The world points of a rendered cut line after a rigid transform expressed
// in its host base map group's LOCAL frame (transformCutLinePoints), split
// the way rebuildCutLineService expects them:
//   - drawn: [{ x, y, z, ref, newRow: true }] the drawn points (fresh rows:
//     a point row is never shared nor moved in place);
//   - oldDerived: [{ x, y, z, stop }] the transformed derived points (their
//     « Stop » follows when the new extension still passes there).
// `entry`: the line's cutLineObjectsStore entry (vertices in world space, in
// the order of `raw.points`); `group`: the base map group; `raw`: the DB
// row; `keepRefs`: false for a copy (the refs keep their `stop` flag only).
// Returns null when the entry no longer matches the row.
export default function getTransformedCutLineDrawn({
  entry,
  group,
  raw,
  transform,
  times = 1,
  keepRefs = true,
}) {
  if (!entry?.vertices?.length || !group || !raw?.points) return null;
  if (raw.points.length !== entry.vertices.length) return null;

  group.updateWorldMatrix(true, false);
  const local = entry.vertices.map((v) => group.worldToLocal(v.world.clone()));
  const transformed = transformCutLinePoints(local, transform, times);
  if (!transformed) return null;

  const drawn = [];
  const oldDerived = [];
  transformed.forEach((p, i) => {
    const world = group.localToWorld(new Vector3(p.x, p.y, p.z));
    const point = { x: world.x, y: world.y, z: world.z };
    const ref = raw.points[i];
    if (ref.derived) {
      oldDerived.push({ ...point, stop: ref.stop });
    } else {
      drawn.push({
        ...point,
        ref: keepRefs ? ref : ref.stop ? { stop: true } : {},
        newRow: true,
      });
    }
  });
  return { drawn, oldDerived };
}
