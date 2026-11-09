import {
  asClosedSolidOperand,
  getShape3DKey,
} from "Features/annotations/constants/shape3DConfig";

import createAnnotationObject3D from "./createAnnotationObject3D";

/**
 * Resolve an annotation into one or more Object3D solids (to be used as the
 * SUBTRACTION operand). Returned objects are unparented; the caller attaches
 * them to the basemap group so their matrixWorld matches the source's frame.
 *
 * Every annotation builds its solid synchronously via the normal display
 * builder (kept async for its callers' sake).
 *
 * @returns {Promise<Array<import("three").Object3D>>}
 */
export default async function buildAnnotationSolidObjectsAsync(
  annotation,
  baseMapForRender,
  options
) {
  if (!annotation || !baseMapForRender) return [];

  // A REVOLUTION operand must be the FULL solid (shape3D.solid builds it
  // watertight): the camera-driven 180° half-view is display-only and would
  // otherwise cut the cutter in two. The axis's own partial sector
  // (`revolutionPhi`) still applies — it is part of the annotation.
  let operandOptions = options;
  if (getShape3DKey(annotation.shape3D) === "REVOLUTION" && options) {
    operandOptions = {
      ...options,
      revolutionSection: undefined,
      revolutionSectionFill: false,
    };
  }

  // A « Fosse » operand is its CLOSED prism: the removed top face cuts the
  // coplanar face of a host glued to it.
  const object = createAnnotationObject3D(
    asClosedSolidOperand(annotation),
    baseMapForRender,
    operandOptions
  );
  return object ? [object] : [];
}
