import db from "App/db/db";

import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";

import { mesh3dToLocal } from "../utils/mesh3dFrame";

// Render metrics of a base map from its raw db records (no BaseMap instance,
// no 3D editor): what converts a stored mesh to local meters and back.
export function getMesh3dMetrics(baseMapRecord, versions = []) {
  const imageSize = getBaseMapImageSizeFromRecord(baseMapRecord, versions);
  if (!imageSize?.width || !imageSize?.height) return null;
  return {
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    meterByPx: baseMapRecord.meterByPx || 0.01,
  };
}

// The stored mesh of an isMesh3d annotation, ready to edit and write back
// through writeMesh3dService — db only, usable outside the 3D editor (the
// properties panel). Same shape as getEditableMesh3d, minus the scene.
export default async function loadStoredMesh3d(annotationId) {
  const annotation = await db.annotations.get(annotationId);
  if (!annotation?.isMesh3d || annotation.deletedAt) return null;
  const baseMapRecord = await db.baseMaps.get(annotation.baseMapId);
  if (!baseMapRecord) return null;
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(annotation.baseMapId)
    .toArray();
  const metrics = getMesh3dMetrics(baseMapRecord, versions);
  if (!metrics) return null;
  const mesh = mesh3dToLocal(annotation.mesh3d, metrics);
  if (!mesh.faces.length) return null;
  return {
    annotation,
    mesh,
    baseOffsetZ: Number(annotation.offsetZ) || 0,
    metrics,
  };
}
