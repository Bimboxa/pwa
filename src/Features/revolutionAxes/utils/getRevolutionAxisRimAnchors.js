import getRevolutionAxisCutTheta from "./getRevolutionAxisCutTheta.js";

const DEG_TO_RAD = Math.PI / 180;

// Rim snap anchors of a plan REVOLUTION_AXIS in basemap-local metres (y up,
// CCW from local +X, like directionDeg / revolutionAngleStartDeg / EndDeg):
// the two diameter ends along the cut direction of a full circle, the two
// sector ends of a partial revolution — the 3D twin of the 2D
// getRevolutionHandleSnapPoints (pixels, y down), minus the centre, which the
// axis line already provides. Pure, node-testable (relative imports).
export default function getRevolutionAxisRimAnchors({ cx, cy, r, annotation }) {
  const radius = Number(r) || 0;
  if (!(radius > 0) || !annotation) return [];
  const at = (t) => ({
    x: cx + radius * Math.cos(t),
    y: cy + radius * Math.sin(t),
  });
  if (annotation.partialRevolution) {
    return [
      annotation.revolutionAngleStartDeg,
      annotation.revolutionAngleEndDeg,
    ].map((deg) => at((Number(deg) || 0) * DEG_TO_RAD));
  }
  const theta = getRevolutionAxisCutTheta(annotation);
  return [at(theta), at(theta + Math.PI)];
}
