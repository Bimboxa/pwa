// Highlight rects are stored normalized [0..1] (top-left origin) in the frame
// of the PDF page at its INTRINSIC rotation. The viewer may display the page
// with an extra clockwise delta (multiples of 90°): these helpers convert a
// rect between the stored (intrinsic) frame and the displayed frame.

function normalizeDelta(deltaDeg) {
  const d = (((Math.round((deltaDeg ?? 0) / 90) * 90) % 360) + 360) % 360;
  return d;
}

function rotateClockwise(rect, deltaDeg) {
  const { x, y, width, height } = rect;
  switch (normalizeDelta(deltaDeg)) {
    case 90:
      return { x: 1 - (y + height), y: x, width: height, height: width };
    case 180:
      return { x: 1 - (x + width), y: 1 - (y + height), width, height };
    case 270:
      return { x: y, y: 1 - (x + width), width: height, height: width };
    default:
      return { x, y, width, height };
  }
}

// intrinsic frame -> frame displayed with `deltaDeg` clockwise
export function toDisplayedRect(rect, deltaDeg) {
  return rotateClockwise(rect, deltaDeg);
}

// frame displayed with `deltaDeg` clockwise -> intrinsic frame
export function toIntrinsicRect(rect, deltaDeg) {
  return rotateClockwise(rect, 360 - normalizeDelta(deltaDeg));
}
