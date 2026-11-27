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
export const RECTANGLE_QUARTER_TURN_DEG = 90; // T key

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
 *
 * `ignoreLocks`: the rectangle being drawn is not an annotation of the
 * template but the ZONE of « Texturer une zone rectangulaire » — only the
 * typed values constrain it.
 */
export function getRectangleDraftConstraints({
  newAnnotation,
  meterByPx,
  metrics,
  ignoreLocks = false,
}) {
  const { lockedWidth, lockedHeight } = ignoreLocks
    ? { lockedWidth: false, lockedHeight: false }
    : getRectangleSizeLocks(newAnnotation);
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
 * Rectangle drawing tool on a POLYGON / POLYLINE / CUT (not a RECTANGLE
 * annotation): the sides follow the drawing frame (`orthoSnapAngleOffset`,
 * counter-clockwise), the typed X / Y (`metrics.rectX / rectY`, metres) are
 * magnitudes and the cursor `p2` picks the quadrant.
 *
 * Shared by the live preview (DrawingLayer), the click and Enter
 * (InteractionLayer). Same return as `getRectangleFromTwoPoints`.
 */
export function getDrawnRectangleFromTwoPoints({
  p1,
  p2,
  orthoSnapAngleOffset,
  meterByPx,
  metrics,
}) {
  const mPerPx = Number.isFinite(meterByPx) && meterByPx > 0 ? meterByPx : 1;
  const typed = (value) => (value != null ? Math.abs(value) / mPerPx : null);
  return getRectangleFromTwoPoints({
    p1,
    p2,
    rotation: -(orthoSnapAngleOffset || 0),
    widthPx: typed(metrics?.rectX),
    heightPx: typed(metrics?.rectY),
  });
}

// « Texturer une zone rectangulaire » drawing mode (2 clicks: the zone, then
// one RECTANGLE annotation per cell of the layout below).
export const RECTANGLE_FILL_ZONE_MODE = "RECTANGLE_FILL_ZONE";

// Drawing modes that place RECTANGLE annotations (when the draft is one):
// the arrow keys / T rotate the rectangle(s) being placed.
export const RECTANGLE_PLACEMENT_MODES = [
  "ONE_CLICK",
  "RECTANGLE",
  RECTANGLE_FILL_ZONE_MODE,
];

// Safety cap of the layout (a huge zone with a tiny rectangle).
const RECTANGLE_FILL_MAX_COUNT = 2000;

/**
 * Layout of « Texturer une zone rectangulaire »: the zone is the rectangle of
 * the two clicks (sides along the frame rotated by `rotation`), filled with
 * as many `itemWidthPx` × `itemHeightPx` rectangles as fit along each side,
 * spread evenly — the same gap between two rectangles and between a
 * rectangle and the zone border.
 *
 * `zoneWidthPx` / `zoneHeightPx` (optional): side lengths typed by the user
 * (X / Y), the cursor then only picks the quadrant.
 *
 * Returns { corners (zone: A, B, C, D), centers, countX, countY, truncated }.
 * `centers` is empty when the zone is smaller than one rectangle.
 */
export function getRectangleFillLayout({
  p1,
  p2,
  rotation = 0,
  itemWidthPx,
  itemHeightPx,
  zoneWidthPx = null,
  zoneHeightPx = null,
  maxCount = RECTANGLE_FILL_MAX_COUNT,
}) {
  const zone = getRectangleFromTwoPoints({
    p1,
    p2,
    rotation,
    widthPx: zoneWidthPx,
    heightPx: zoneHeightPx,
  });
  const layout = {
    corners: zone.corners,
    centers: [],
    countX: 0,
    countY: 0,
    truncated: false,
  };
  if (!(itemWidthPx > 0) || !(itemHeightPx > 0)) return layout;

  // tolerance: a zone drawn at exactly N × the dimension holds N rectangles
  const EPSILON = 1e-6;
  let countX = Math.floor(zone.width / itemWidthPx + EPSILON);
  let countY = Math.floor(zone.height / itemHeightPx + EPSILON);
  if (!(zone.width > 0) || !(zone.height > 0)) return layout;
  if (countX < 1 || countY < 1) return layout;
  if (countX * countY > maxCount) {
    layout.truncated = true;
    countY = Math.max(1, Math.min(countY, Math.floor(maxCount / countX)));
    countX = Math.min(countX, maxCount);
  }

  const gapX = Math.max(0, (zone.width - countX * itemWidthPx) / (countX + 1));
  const gapY = Math.max(
    0,
    (zone.height - countY * itemHeightPx) / (countY + 1)
  );

  // signed unit vectors of the zone sides, from the first click
  const [A, B, , D] = zone.corners;
  const ux = { x: (B.x - A.x) / zone.width, y: (B.y - A.y) / zone.width };
  const uy = { x: (D.x - A.x) / zone.height, y: (D.y - A.y) / zone.height };

  for (let j = 0; j < countY; j++) {
    const v = gapY + itemHeightPx / 2 + j * (itemHeightPx + gapY);
    for (let i = 0; i < countX; i++) {
      const u = gapX + itemWidthPx / 2 + i * (itemWidthPx + gapX);
      layout.centers.push({
        x: A.x + u * ux.x + v * uy.x,
        y: A.y + u * ux.y + v * uy.y,
      });
    }
  }
  layout.countX = countX;
  layout.countY = countY;
  return layout;
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
