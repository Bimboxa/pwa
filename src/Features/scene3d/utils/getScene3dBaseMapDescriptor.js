import { getZoneFromPolygon } from "./scene3dZoneTransform";

// Bytes stored in db.scene3dAssets for a scan after its clip.
// descriptor: importScene3dFilesService result; clipped:
// clipScene3dAssetsService result.
export function getScene3dBaseMapStoredBytes(descriptor, clipped) {
  return (
    (descriptor.textureBytes ?? 0) -
    (clipped.removedTextureBytes ?? 0) +
    (clipped.geometryBytes ?? 0)
  );
}

// The 4 corners of the scan bbox (scan frame) — the zone when the user
// keeps the whole scan.
export function getScene3dBboxPolygon(bbox) {
  return [
    [bbox.min[0], bbox.min[1]],
    [bbox.max[0], bbox.min[1]],
    [bbox.max[0], bbox.max[1]],
    [bbox.min[0], bbox.max[1]],
  ];
}

// The `scene3d` field of a new scan base map record (see
// docs/baseMaps/SCENE_3D_BASE_MAPS.md).
// descriptor: importScene3dFilesService result; polygon: [[x, y], …] scan
// frame; clipped: clipScene3dAssetsService result.
export default function getScene3dBaseMapDescriptor({
  descriptor,
  polygon,
  rotationDeg,
  clipped,
}) {
  const zone = getZoneFromPolygon(polygon, rotationDeg);
  return {
    sceneId: descriptor.sceneId,
    srcFileName: descriptor.srcFileName,
    origin: descriptor.origin,
    bbox: descriptor.bbox,
    zone: {
      rotationDeg: rotationDeg || 0,
      center: zone.center,
      width: zone.width,
      height: zone.height,
      polygon,
      zMin: clipped.zMin,
      zMax: clipped.zMax,
    },
    display3d: "MESH",
    vertexCount: clipped.vertexCount,
    faceCount: clipped.faceCount,
    atlasCount: descriptor.atlasCount,
    storedBytes: getScene3dBaseMapStoredBytes(descriptor, clipped),
  };
}
