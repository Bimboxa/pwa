// Pure geometry of a label leader line, in base-image px.
//
// Inputs (image px unless stated):
// - targetPx, labelPx: leader ends (labelPx = chip CENTER, the chip is
//   center-anchored and screen-constant).
// - halfWidthImg: half the chip width converted to image px.
// - stubImg: horizontal stub length converted to image px (0 = no stub).
// - mode: "FIXED" (elbow derived from the chip each render) | "VARIABLE"
//   (elbow x pinned in map space, `elbowX`; falls back to FIXED when null).
//
// Output: { points: [{x,y}, ...], elbow: {x,y}|null, side: -1|0|1 }.
// The stub is always horizontal at the chip's y; the chip (painted after the
// line) hides whatever runs under it.

export default function getLabelLeaderGeometry({
  targetPx,
  labelPx,
  halfWidthImg,
  stubImg,
  mode,
  elbowX,
}) {
  const straight = { points: [targetPx, labelPx], elbow: null, side: 0 };
  if (!targetPx || !labelPx) return straight;
  if (!(stubImg > 0)) return straight;

  const halfW = Math.max(0, halfWidthImg || 0);

  if (mode === "VARIABLE" && Number.isFinite(elbowX)) {
    const dxE = elbowX - labelPx.x;
    const side = Math.sign(dxE);
    if (side === 0) return straight;
    const elbow = { x: elbowX, y: labelPx.y };
    if (Math.abs(dxE) <= halfW) {
      // Elbow under the chip: the handle stays where it is, no visible stub.
      return { points: [targetPx, elbow], elbow, side };
    }
    const attach = { x: labelPx.x + side * halfW, y: labelPx.y };
    return { points: [targetPx, elbow, attach], elbow, side };
  }

  // FIXED (or VARIABLE without a stored elbow)
  const dx = targetPx.x - labelPx.x;
  const side = Math.sign(dx);
  if (side === 0 || Math.abs(dx) <= halfW) return straight;
  const attach = { x: labelPx.x + side * halfW, y: labelPx.y };
  // Never overshoot the target's x: shorten the stub when the target is close.
  const stubEff = Math.min(stubImg, Math.abs(dx) - halfW);
  const elbow = { x: attach.x + side * stubEff, y: labelPx.y };
  return { points: [targetPx, elbow, attach], elbow, side };
}
