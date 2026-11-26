import { getRectangleCenter, rotatePointAround } from "./getRectangleCorners";

// Resize of a (possibly rotated) RECTANGLE bbox by one of its corner handles.
//
// `deltaPos` is the cursor delta in the bbox space (world axes). It is first
// expressed in the rectangle's own frame, so dragging a corner of a rotated
// rectangle stretches its sides, and the opposite corner stays put on screen.
// A locked dimension ignores its delta.
//
// Shared by the drag preview (applyDeltaPosToAnnotation) and the commit
// (MainMapEditorV3) so both always agree.

const MIN_SIZE = 4;

export default function resizeRectangleBbox({
  bbox,
  rotation = 0,
  handle,
  deltaPos,
  lockedWidth = false,
  lockedHeight = false,
  minSize = MIN_SIZE,
}) {
  const sx = handle.includes("E") ? 1 : handle.includes("W") ? -1 : 0;
  const sy = handle.includes("S") ? 1 : handle.includes("N") ? -1 : 0;

  // cursor delta in the rectangle's local frame
  const local = rotatePointAround(deltaPos, { x: 0, y: 0 }, -rotation);

  let width = bbox.width;
  let height = bbox.height;
  if (!lockedWidth && sx) width = Math.max(minSize, width + sx * local.x);
  if (!lockedHeight && sy) height = Math.max(minSize, height + sy * local.y);

  // the corner opposite to the handle is the fixed point
  const center = getRectangleCenter(bbox);
  const anchor = rotatePointAround(
    {
      x: center.x - (sx * bbox.width) / 2,
      y: center.y - (sy * bbox.height) / 2,
    },
    center,
    rotation
  );
  const offset = rotatePointAround(
    { x: (sx * width) / 2, y: (sy * height) / 2 },
    { x: 0, y: 0 },
    rotation
  );
  const newCenter = { x: anchor.x + offset.x, y: anchor.y + offset.y };

  return {
    x: newCenter.x - width / 2,
    y: newCenter.y - height / 2,
    width,
    height,
  };
}
