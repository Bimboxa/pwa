// getAxisFrameFromDirection.js
//
// Crosshair frame aligned on a drawing direction (the segment being drawn
// while Shift constrains its angle).
//
// Returns the crosshair rotation that puts one branch along `dir`, in the same
// convention as the ortho-snap angle (ScreenCursorV2 / getAxisSnap), plus the
// branch that ends up NORMAL to `dir`. The rotation is kept within ±45° by
// swapping the branch roles, so the crosshair never turns more than needed.
//
// Params:
//   - dir: { x, y } direction of the segment (y down, any length > 0)
//
// Returns:
//   {
//     angleDeg: number,        // crosshair rotation, in [-45, 45]
//     crossBranch: "V" | "H",  // branch normal to `dir` (the other one runs along it)
//   }

export default function getAxisFrameFromDirection(dir) {
  // Angle for which the horizontal branch runs along `dir`
  const rawDeg = (Math.atan2(-dir.y, dir.x) * 180) / Math.PI;
  const quarterTurns = Math.round(rawDeg / 90);
  const angleDeg = rawDeg - quarterTurns * 90;
  // Even number of quarter turns: the horizontal branch still runs along `dir`
  const isHorizontalAlong = quarterTurns % 2 === 0;
  return { angleDeg, crossBranch: isHorizontalAlong ? "V" : "H" };
}
