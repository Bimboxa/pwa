import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

// Drafts (`annotations.newAnnotation`) of the revolution axis tools. A
// revolution axis belongs to a base map + a scope: its draft carries no
// annotation template and no listing (useHandleCommitDrawing then binds the
// row to the selected scope).

// Plan axis — armed with the REVOLUTION_AXIS_PLAN tool (centre, then radius +
// direction) on a HORIZONTAL base map.
export function buildRevolutionAxisDraft() {
  return {
    ...getDefaultsForShape("REVOLUTION_AXIS"),
    type: "REVOLUTION_AXIS",
    drawingShape: "REVOLUTION_AXIS",
  };
}

// Placement of an existing axis — armed with the REVOLUTION_AXIS_PLACE tool
// (one click) on a VERTICAL base map: the click is where the axis centre sits
// in the elevation, and it poses that base map in 3D. A placement is just a
// point + style: none of the axis geometry scalars.
export function buildRevolutionAxisPlacementDraft(axis) {
  return {
    ...getDefaultsForShape("REVOLUTION_AXIS_PLACEMENT"),
    ...(axis?.strokeColor ? { strokeColor: axis.strokeColor } : {}),
    type: "REVOLUTION_AXIS_PLACEMENT",
    drawingShape: "REVOLUTION_AXIS_PLACEMENT",
    revolutionAxisId: axis?.id,
    label: axis?.label,
  };
}
