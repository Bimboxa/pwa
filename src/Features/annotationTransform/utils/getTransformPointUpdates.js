import applyWrapperTransformToPoints from "../../mapEditor/utils/applyWrapperTransformToPoints.js";

// New pixel positions of every point of the carried annotations (main
// points, cuts, inner points, guide / iso-height / profile line refs) after a
// « Déplacer » / « Tourner » transform. Map pointId → {x, y}.
//
// transform:
//   { kind: "MOVE", deltaPx: {x, y} }
//   { kind: "ROTATE", pivotPx: {x, y}, angleDeg }   (pixel space, y down: a
//     positive angle turns clockwise on screen)
export default function getTransformPointUpdates({ annotations, transform }) {
  if (transform?.kind === "MOVE") {
    return applyWrapperTransformToPoints({
      annotations,
      wrapperBbox: { x: 0, y: 0, width: 0, height: 0 },
      deltaPos: transform.deltaPx,
      partType: "MOVE",
    });
  }
  if (transform?.kind === "ROTATE") {
    // The ROTATE branch rotates around the wrapperBbox CENTER: a degenerate
    // zero-size bbox centered on the pivot makes it rotate around the pivot.
    return applyWrapperTransformToPoints({
      annotations,
      wrapperBbox: getPivotBbox(transform.pivotPx),
      deltaPos: { x: transform.angleDeg, y: 0 },
      partType: "ROTATE",
    });
  }
  return new Map();
}

export function getPivotBbox(pivotPx) {
  return { x: pivotPx.x, y: pivotPx.y, width: 0, height: 0 };
}
