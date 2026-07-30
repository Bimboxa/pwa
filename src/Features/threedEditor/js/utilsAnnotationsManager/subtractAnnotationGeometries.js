import { Matrix4 } from "three";
import {
  Brush,
  Evaluator,
  SUBTRACTION,
  HOLLOW_SUBTRACTION,
} from "three-bvh-csg";

import { getSolidMeshesFromObject3D } from "./getSolidMeshFromObject3D";

// Strip everything but position/normal and clear draw groups so Brush gets a
// clean triangle soup. Mutates+returns the passed geometry.
function sanitizeGeometry(geom) {
  if (!geom) return null;
  if (!geom.getAttribute("normal")) geom.computeVertexNormals();
  for (const name of Object.keys(geom.attributes)) {
    if (name !== "position" && name !== "normal") geom.deleteAttribute(name);
  }
  geom.clearGroups?.();
  return geom;
}

// Clone a mesh's geometry baked into WORLD space (its own matrixWorld applied).
function worldGeometry(mesh) {
  mesh.updateMatrixWorld?.(true);
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  return sanitizeGeometry(g);
}

// Collect every renderable mesh inside an object (a target may be a Group of
// several prism meshes — e.g. an EXTRUSION_PROFILE solid).
function collectMeshes(object) {
  const meshes = [];
  object.updateMatrixWorld?.(true);
  object.traverse?.((c) => {
    if (c.isMesh && c.geometry) meshes.push(c);
  });
  return meshes;
}

/**
 * Carve `targetObjects` out of `sourceObject`'s solid mesh(es) with a 3D
 * boolean SUBTRACTION. Every `role === "SOLID"` mesh in the source is carved
 * (a REVOLUTION with hidden segments emits one lathe mesh per run). Both
 * source and targets are read in WORLD space (each mesh's own matrixWorld), so
 * the operands share a frame no matter how the objects are parented; the
 * world-space result is then mapped back into each source mesh's LOCAL frame
 * and assigned without touching the mesh transform — so the carved mesh
 * renders in exactly the same place as before (no dislocation).
 *
 * IMPORTANT: callers must have attached source + target objects to their final
 * parents (and the parents' matrices updated) BEFORE calling, so matrixWorld is
 * correct on both sides.
 *
 * @param {import("three").Object3D} sourceObject
 * @param {Array<import("three").Object3D>} targetObjects
 * @returns {import("three").Object3D} the same sourceObject (carved), or
 *   unchanged if the boolean could not be evaluated.
 */
export default function subtractAnnotationGeometries(
  sourceObject,
  targetObjects,
  options = {}
) {
  if (!sourceObject) return sourceObject;
  const targets = (targetObjects || []).filter(Boolean);
  if (targets.length === 0) return sourceObject;

  const sourceMeshes = getSolidMeshesFromObject3D(sourceObject);
  if (sourceMeshes.length === 0) return sourceObject;

  // For an OPEN surface source (e.g. an EXTRUSION_PROFILE swept surface or a
  // REVOLUTION lathe shell), use HOLLOW_SUBTRACTION: it only clips the source
  // triangles and does NOT add the target's cap faces (which a regular
  // SUBTRACTION inserts to close a volume — showing up as stray triangles
  // rendered in the source's material). Closed solids (POLYGON / RECTANGLE)
  // use a normal SUBTRACTION.
  const operation = options.hollow ? HOLLOW_SUBTRACTION : SUBTRACTION;

  try {
    const evaluator = new Evaluator();
    evaluator.attributes = ["position", "normal"];
    evaluator.useGroups = false;

    // Target brushes in WORLD space, built once and reused across source
    // meshes (evaluate does not mutate the target brush).
    const targetBrushes = [];
    for (const targetObject of targets) {
      for (const targetMesh of collectMeshes(targetObject)) {
        const targetBrush = new Brush(worldGeometry(targetMesh));
        targetBrush.updateMatrixWorld();
        targetBrushes.push(targetBrush);
      }
    }
    if (targetBrushes.length === 0) return sourceObject;

    let didSubtract = false;
    for (const sourceMesh of sourceMeshes) {
      sourceMesh.updateMatrixWorld(true);
      const worldToLocal = new Matrix4().copy(sourceMesh.matrixWorld).invert();

      // Source brush in WORLD space (identity brush matrix → operates in world).
      let resultBrush = new Brush(worldGeometry(sourceMesh));
      resultBrush.updateMatrixWorld();

      for (const targetBrush of targetBrushes) {
        resultBrush = evaluator.evaluate(resultBrush, targetBrush, operation);
      }
      if (!resultBrush.geometry) continue;

      // World-space result → source mesh LOCAL frame, so the (untouched)
      // source mesh transform places it back exactly where the original
      // geometry was.
      const resultGeom = resultBrush.geometry;
      resultGeom.applyMatrix4(worldToLocal);

      const oldGeom = sourceMesh.geometry;
      sourceMesh.geometry = resultGeom;
      oldGeom?.dispose?.();

      sourceMesh.userData = {
        ...(sourceMesh.userData ?? {}),
        role: "SOLID",
        hasSubtraction: true,
      };
      didSubtract = true;
    }
    if (!didSubtract) return sourceObject;

    // Remove stale decoration children (edges / iso lines drawn from the
    // original, un-carved outline), keeping every carved mesh (or any child
    // whose subtree holds one).
    if (sourceObject.children) {
      const keep = new Set(sourceMeshes);
      const holdsCarvedMesh = (obj) => {
        let found = false;
        obj.traverse?.((c) => {
          if (keep.has(c)) found = true;
        });
        return found;
      };
      const toRemove = sourceObject.children.filter((c) => !holdsCarvedMesh(c));
      for (const child of toRemove) {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
        sourceObject.remove(child);
      }
    }

    return sourceObject;
  } catch (e) {
    console.error("[subtractAnnotationGeometries] CSG evaluation failed", e);
    return sourceObject;
  }
}
