import { Group, Mesh, MeshBasicMaterial } from "three";

import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";

import createAnnotationObject3D from "./createAnnotationObject3D";
import buildExtrudedProfileSolidGeometries from "./buildExtrudedProfileSolidGeometries";

const CSG_TARGET_MATERIAL = new MeshBasicMaterial();

/**
 * Resolve an annotation into one or more Object3D solids (to be used as the
 * SUBTRACTION operand). Returned objects are unparented; the caller attaches
 * them to the basemap group so their matrixWorld matches the source's frame.
 *
 * EXTRUSION_PROFILE guides get capped per-segment prisms (their display mesh is
 * an open async surface). Everything else builds a closed solid synchronously
 * via the normal display builder.
 *
 * @returns {Promise<Array<import("three").Object3D>>}
 */
export default async function buildAnnotationSolidObjectsAsync(
  annotation,
  baseMapForRender,
  options
) {
  if (!annotation || !baseMapForRender) return [];

  if (getShape3DKey(annotation.shape3D) === "EXTRUSION_PROFILE") {
    const geometries = await buildExtrudedProfileSolidGeometries(
      annotation,
      baseMapForRender
    );
    if (!geometries.length) return [];
    const group = new Group();
    for (const geom of geometries) {
      const mesh = new Mesh(geom, CSG_TARGET_MATERIAL);
      mesh.userData = { role: "SOLID" };
      group.add(mesh);
    }
    return [group];
  }

  const object = createAnnotationObject3D(annotation, baseMapForRender, options);
  return object ? [object] : [];
}
