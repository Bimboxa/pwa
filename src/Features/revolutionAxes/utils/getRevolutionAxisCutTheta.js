// Effective cut-diameter direction of a plan REVOLUTION_AXIS, in radians:
// `directionDeg` in the plan local metre frame (y up, CCW from local +X)
// with `invertHalf` folded in (+π) — the `theta` of getRevolutionAxisPlanFrame.
export default function getRevolutionAxisCutTheta(axis) {
  return (
    ((Number(axis?.directionDeg) || 0) * Math.PI) / 180 +
    (axis?.invertHalf ? Math.PI : 0)
  );
}
