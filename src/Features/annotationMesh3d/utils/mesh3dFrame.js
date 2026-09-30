import { cloneFace } from "./mesh3dTopology.js";

// Conversions between the two forms of an annotation mesh.
//
// STORED (annotation.mesh3d, in db.annotations):
//   { vertices: [[x, y, z], …], faces: [{ loop, holes }] }
//   x, y normalized to [0..1] against the base map reference image size —
//   the db.points convention — and z in meters ABOVE annotation.offsetZ.
//
// LOCAL (what the geometry utils and the 3D builder work on):
//   { vertices: [{x, y, z}, …], faces } in base-map-local meters (origin at
//   the image center, y up — see pixelToWorld), z still relative to offsetZ.
//
// metrics: { imageWidth, imageHeight, meterByPx } (getBaseMapForRender).

export function normalizedToLocal(vertex, metrics) {
  const { imageWidth, imageHeight, meterByPx } = metrics;
  return {
    x: (vertex[0] * imageWidth - imageWidth / 2) * meterByPx,
    y: -(vertex[1] * imageHeight - imageHeight / 2) * meterByPx,
    z: vertex[2] || 0,
  };
}

export function localToNormalized(point, metrics) {
  const { imageWidth, imageHeight, meterByPx } = metrics;
  return [
    (point.x / meterByPx + imageWidth / 2) / imageWidth,
    (-point.y / meterByPx + imageHeight / 2) / imageHeight,
    point.z || 0,
  ];
}

export function mesh3dToLocal(mesh3d, metrics) {
  return {
    vertices: (mesh3d?.vertices || []).map((v) =>
      normalizedToLocal(v, metrics)
    ),
    faces: (mesh3d?.faces || []).map(cloneFace),
  };
}

// Local mesh -> stored form. The lowest vertex is re-based on z = 0 and the
// shift moved into offsetZ, so annotation.offsetZ always reads as the
// altitude of the bottom of the mesh (like any other annotation).
export function mesh3dFromLocal(localMesh, metrics, baseOffsetZ = 0) {
  let minZ = Infinity;
  for (const v of localMesh.vertices) if (v.z < minZ) minZ = v.z;
  if (!Number.isFinite(minZ)) minZ = 0;
  return {
    mesh3d: {
      vertices: localMesh.vertices.map((v) =>
        localToNormalized({ x: v.x, y: v.y, z: v.z - minZ }, metrics)
      ),
      faces: localMesh.faces.map(cloneFace),
    },
    offsetZ: (Number(baseOffsetZ) || 0) + minZ,
  };
}
