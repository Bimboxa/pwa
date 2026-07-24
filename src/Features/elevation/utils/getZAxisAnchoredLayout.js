// Layout of the Z = 0 line + Offset field relative to the screen-fixed Z axis
// (shared by the section and the surface elevation renderers).
//
//   - the Z = 0 dashed line is EXTENDED to reach the axis (min/max of the
//     profile extent and the axis world x);
//   - the Offset field is placed either ON the axis (a fixed screen gap away,
//     hugging the axis-facing edge) or FAR-LEFT of the profile (`offsetPlacement
//     = "left"`) — used when the axis side is crowded (POLYGON silhouette: the
//     axis-side endpoint + its field would collide with the offset).
//
// Fallback (no axis yet — camera not ready): the far-left placement, so the
// first paint is not degenerate.
//
// Inputs (all in section-space world units, except the *_PX screen sizes):
//   xMin, xMax      — developed profile extent
//   xPad            — padding already applied around the profile
//   zAxisWorldX     — world x of the screen-fixed axis (null when unknown)
//   zAxisSide       — "left" | "right"
//   offsetPlacement — "axis" (on the Z axis) | "left" (far-left of the profile)
//   offsetW         — Offset field width (screen px)
//   offsetGapPx     — screen gap between the anchor and the field
//
// Returns { hasAxis, z0x1, z0x2, offsetAnchorX, offsetFieldX, offsetJustify,
// offsetW }.
export default function getZAxisAnchoredLayout({
  xMin,
  xMax,
  xPad,
  zAxisWorldX,
  zAxisSide = "right",
  offsetPlacement = "axis",
  offsetW = 124,
  offsetGapPx = 8,
}) {
  const hasAxis = Number.isFinite(zAxisWorldX);
  const left = xMin - xPad;
  const right = xMax + xPad;

  const z0x1 = hasAxis ? Math.min(left, zAxisWorldX) : left;
  const z0x2 = hasAxis ? Math.max(right, zAxisWorldX) : right;

  // "left" (or no axis yet): the field sits just LEFT of the profile, where the
  // Z = 0 line begins — clear of any axis-side content. Otherwise it hugs the
  // axis-facing edge (right axis → to its left; left axis → to its right).
  const onAxis = hasAxis && offsetPlacement !== "left";
  const offsetAnchorX = onAxis ? zAxisWorldX : left;
  const offsetFieldX =
    !onAxis || zAxisSide === "right"
      ? -(offsetGapPx + offsetW) // far-left / inside the right axis
      : offsetGapPx; // inside the left axis
  const offsetJustify =
    !onAxis || zAxisSide === "right" ? "flex-end" : "flex-start";

  return {
    hasAxis,
    z0x1,
    z0x2,
    offsetAnchorX,
    offsetFieldX,
    offsetJustify,
    offsetW,
  };
}
