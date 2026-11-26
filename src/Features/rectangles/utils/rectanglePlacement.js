import getRectangleSizeLocks from "./getRectangleSizeLocks";
import getRectangleSizeInPx from "./getRectangleSizeInPx";

// Placement of a RECTANGLE annotation while drawing (1-click and 2-click
// tools). Shared by the live preview (DrawingLayer), the click
// (InteractionLayer) and the commit (MainMapEditorV3) so all three agree.
//
// Rotations are in degrees with the SVG convention of NodeRectangleStatic:
// positive = clockwise on screen (y down).

export const RECTANGLE_ROTATE_STEP_DEG = 10;
export const RECTANGLE_ROTATE_FINE_STEP_DEG = 1;

/**
 * Rotation of the rectangle being placed: the drawing frame
 * (`orthoSnapAngleOffset`, counter-clockwise) plus the ← → delta typed by the
 * user (clockwise).
 */
export function getRectanglePlacementRotation(orthoSnapAngleOffset, deltaDeg) {
  const rotation = -(orthoSnapAngleOffset || 0) + (deltaDeg || 0);
  return ((rotation % 360) + 360) % 360;
}

/**
 * Forced side lengths (pixels, magnitudes) of the 2-click tool: a dimension
 * locked by the template wins, else the value typed in the X / Y buffers
 * (`metrics.rectX / rectY`, metres). `null` = free, follows the cursor.
 */
export function getRectangleDraftConstraints({
  newAnnotation,
  meterByPx,
  metrics,
}) {
  const { lockedWidth, lockedHeight } = getRectangleSizeLocks(newAnnotation);
  const lockedPx = getRectangleSizeInPx({
    size: newAnnotation?.size,
    sizeUnit: newAnnotation?.sizeUnit,
    meterByPx,
  });
  const mPerPx = Number.isFinite(meterByPx) && meterByPx > 0 ? meterByPx : 1;
  const typed = (value) => (value != null ? Math.abs(value) / mPerPx : null);
  return {
    widthPx:
      lockedWidth && lockedPx.width !== null
        ? lockedPx.width
        : typed(metrics?.rectX),
    heightPx:
      lockedHeight && lockedPx.height !== null
        ? lockedPx.height
        : typed(metrics?.rectY),
  };
}

/**
 * Rectangle of the 2-click tool: `p1` is a corner, `p2` the cursor. The sides
 * follow the frame rotated by `rotation`; a forced side length keeps its
 * magnitude and takes its direction from the quadrant of the cursor.
 *
 * Returns the corners A (= p1), B, C (opposite corner), D, the centre and the
 * side lengths (width along the rotated x axis, height along the rotated y).
 */
export function getRectangleFromTwoPoints({
  p1,
  p2,
  rotation = 0,
  widthPx = null,
  heightPx = null,
}) {
  const theta = (rotation * Math.PI) / 180;
  const ax1 = { x: Math.cos(theta), y: Math.sin(theta) };
  const ax2 = { x: -Math.sin(theta), y: Math.cos(theta) };

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const raw1 = dx * ax1.x + dy * ax1.y;
  const raw2 = dx * ax2.x + dy * ax2.y;
  const d1 = widthPx != null ? (raw1 < 0 ? -widthPx : widthPx) : raw1;
  const d2 = heightPx != null ? (raw2 < 0 ? -heightPx : heightPx) : raw2;

  const A = { x: p1.x, y: p1.y };
  const B = { x: A.x + d1 * ax1.x, y: A.y + d1 * ax1.y };
  const C = { x: B.x + d2 * ax2.x, y: B.y + d2 * ax2.y };
  const D = { x: A.x + d2 * ax2.x, y: A.y + d2 * ax2.y };

  return {
    corners: [A, B, C, D],
    center: { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 },
    width: Math.abs(d1),
    height: Math.abs(d2),
  };
}

/**
 * The two raw points (unrotated bbox corners, top-left then bottom-right)
 * written by the `drawRectangle` commit for a rectangle of the given centre
 * and size. The rotation is stored apart, around that centre.
 */
export function getRectangleRawPoints({ center, width, height }) {
  return [
    { x: center.x - width / 2, y: center.y - height / 2 },
    { x: center.x + width / 2, y: center.y + height / 2 },
  ];
}
