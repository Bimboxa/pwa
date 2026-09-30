import { Vector3 } from "three";

import db from "App/db/db";

import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import { MESH3D_Z_FIGHT_OFFSET } from "Features/threedEditor/js/utilsAnnotationsManager/buildMesh3dAnnotationObject";

import isAnnotationConvertibleToMesh3d from "../utils/isAnnotationConvertibleToMesh3d";
import { mesh3dToLocal } from "../utils/mesh3dFrame";
import convertObject3DToMesh3d from "./convertObject3DToMesh3d";

// Everything a 3D tool needs to edit the mesh of an annotation:
//
//   {
//     annotation,    // db row
//     mesh,          // LOCAL mesh, z relative to baseOffsetZ
//     baseOffsetZ,   // altitude the local z is measured from
//     metrics,       // base map render metrics (normalized <-> local)
//     baseMapGroup,  // three.js group of the base map (local <-> world)
//     isConversion,  // true when the annotation is not an isMesh3d one YET
//   }
//
// An isMesh3d annotation returns its stored mesh. A regular annotation is
// converted IN MEMORY from its live 3D object — nothing is written until the
// tool commits through writeMesh3dService. Null when not editable.
export default async function getEditableMesh3d({ editor, annotationId }) {
  const sceneManager = editor?.sceneManager;
  const annotation = await db.annotations.get(annotationId);
  if (!sceneManager || !annotation || annotation.deletedAt) return null;

  const baseMap =
    sceneManager.imagesManager?.baseMapsMap?.[annotation.baseMapId];
  const metrics = getBaseMapForRender(baseMap);
  const baseMapGroup = sceneManager.imagesManager?.getGroup?.(
    annotation.baseMapId
  );
  if (!metrics || !baseMapGroup) return null;

  if (annotation.isMesh3d) {
    const mesh = mesh3dToLocal(annotation.mesh3d, metrics);
    if (!mesh.faces.length) return null;
    return {
      annotation,
      mesh,
      baseOffsetZ: Number(annotation.offsetZ) || 0,
      metrics,
      baseMapGroup,
      isConversion: false,
    };
  }

  if (!isAnnotationConvertibleToMesh3d(annotation)) return null;
  const object =
    sceneManager.annotationsManager?.annotationsObjectsMap?.[annotationId];
  const mesh = convertObject3DToMesh3d(object, baseMapGroup);
  if (!mesh) return null;
  return {
    annotation,
    mesh,
    baseOffsetZ: 0,
    metrics,
    baseMapGroup,
    isConversion: true,
  };
}

// World point -> LOCAL mesh coordinates of an editable mesh (and back). The
// rendered geometry sits baseOffsetZ + the 1 mm z-fight lift above the mesh's
// own z.
export function worldToMesh3dLocal(point, { baseMapGroup, baseOffsetZ }) {
  const local = baseMapGroup.worldToLocal(
    new Vector3(point.x, point.y, point.z)
  );
  return {
    x: local.x,
    y: local.y,
    z: local.z - baseOffsetZ - MESH3D_Z_FIGHT_OFFSET,
  };
}

export function mesh3dLocalToWorld(point, { baseMapGroup, baseOffsetZ }) {
  return baseMapGroup.localToWorld(
    new Vector3(point.x, point.y, point.z + baseOffsetZ + MESH3D_Z_FIGHT_OFFSET)
  );
}
