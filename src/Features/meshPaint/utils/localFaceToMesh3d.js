import { buildMesh3dFromPlanarFaces } from "../../annotationMesh3d/utils/buildMesh3dFromTriangles.js";

import {
  getPolygonNormal,
  isCurvedFace,
  orientFaceLoops,
} from "./meshPaintGeometry.js";

// A picked « Pinceau » facet → the LOCAL mesh of an annotation mesh
// (`isMesh3d`): one face per polygon, looking at the painted side.
//
// localFace: LocalFace {polygons: [{contour, holes}], normal, curved?} in
// base-map-local meters. A planar face takes its side from `normal`; each
// facet of a curved surface from its own contour winding (orientFaceLoops).
//
// Pure (no three.js): node-testable, relative imports only.
// Returns {vertices: [{x, y, z}], faces: [{loop, holes}]}, or null.
export default function localFaceToMesh3d(localFace) {
  if (!localFace?.polygons?.length) return null;
  const oriented = orientFaceLoops(localFace);
  const curved = isCurvedFace(oriented);

  const rawFaces = [];
  for (const polygon of oriented.polygons) {
    if ((polygon.contour?.length ?? 0) < 3) continue;
    const normal = curved ? getPolygonNormal(polygon) : oriented.normal;
    if (!normal) continue;
    rawFaces.push({
      contour: polygon.contour,
      holes: polygon.holes || [],
      normal,
    });
  }
  return buildMesh3dFromPlanarFaces(rawFaces);
}
