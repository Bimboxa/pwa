import { Vector3 } from "three";

import {
  makeInRect,
  makeSegmentCrossesRect,
} from "Features/annotations/utils/segmentCrossesRect";
import { LASSO_MODE_CROSSING } from "Features/mapEditorGeneric/utils/lassoMode";

// 3D lasso hit-test of a world-space AABB against a client-space rectangle,
// per lasso mode (see lassoMode):
//   WINDOW   → the 8 projected corners are all on screen and inside the rect;
//   CROSSING → the projected center is inside (historical rule), or a corner
//              is inside, or one of the 12 projected box edges crosses a side.
// The box is the world AABB (Box3.setFromObject), so a rotated OBJECT_3D must
// have its whole AABB inside a WINDOW lasso.

// Corner i: bit 0 → max.x, bit 1 → max.y, bit 2 → max.z.
const CORNER_COUNT = 8;
const BOX_EDGES = [];
for (let i = 0; i < CORNER_COUNT; i++) {
  for (const bit of [1, 2, 4]) {
    if (!(i & bit)) BOX_EDGES.push([i, i | bit]);
  }
}

const scratch = new Vector3();

// Project a world point to client pixels. Returns null when the point is not
// on screen depth-wise (behind the camera, before the near plane or past the
// far plane: NDC z outside [-1, 1]), where the x / y projection is garbage.
export const projectWorldToClient = (world, camera, canvasRect) => {
  scratch.copy(world).project(camera);
  if (!(scratch.z >= -1 && scratch.z <= 1)) return null;
  return {
    x: canvasRect.left + (scratch.x * 0.5 + 0.5) * canvasRect.width,
    y: canvasRect.top + (-scratch.y * 0.5 + 0.5) * canvasRect.height,
  };
};

const corner = new Vector3();

export default function box3HitsLassoRect({ box, camera, canvasRect, rect }) {
  if (!box || box.isEmpty() || !rect) return false;
  const inRect = makeInRect(rect);
  const corners = [];
  for (let i = 0; i < CORNER_COUNT; i++) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z
    );
    corners.push(projectWorldToClient(corner, camera, canvasRect));
  }

  if (rect.mode !== LASSO_MODE_CROSSING) {
    return corners.every((c) => c && inRect(c));
  }

  const center = projectWorldToClient(
    box.getCenter(corner),
    camera,
    canvasRect
  );
  if (center && inRect(center)) return true;
  if (corners.some((c) => c && inRect(c))) return true;
  const crosses = makeSegmentCrossesRect(rect);
  return BOX_EDGES.some(
    ([i, j]) => corners[i] && corners[j] && crosses(corners[i], corners[j])
  );
}
