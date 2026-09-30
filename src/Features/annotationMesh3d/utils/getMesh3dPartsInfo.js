import { length, sub } from "../../threedMesh/utils/vec3Utils.js";

import { canMergeMesh3dFacesAtEdge } from "./editMesh3dParts.js";
import { MESH3D_EDGE_PART, MESH3D_FACE_PART } from "./mesh3dPartIds.js";
import { getFaceArea, getFaceLoops, getFaceNormal } from "./mesh3dTopology.js";

// |normal · plan normal| thresholds of the face orientation vs the base map.
const PARALLEL_COS = 0.999;
const PERPENDICULAR_COS = 0.02;

// Orientation of a face against its base map plane (local z is the plan
// normal): "PARALLEL" (a floor / roof on a plan view), "PERPENDICULAR" (a
// wall) or "OBLIQUE", with the slope angle in degrees.
export function getMesh3dFaceOrientation(normal) {
  const cos = Math.min(1, Math.abs(normal.z));
  const angleDeg = (Math.acos(cos) * 180) / Math.PI;
  if (cos > PARALLEL_COS) return { kind: "PARALLEL", angleDeg: 0 };
  if (cos < PERPENDICULAR_COS) return { kind: "PERPENDICULAR", angleDeg: 90 };
  return { kind: "OBLIQUE", angleDeg };
}

// Measures of the selected parts of a LOCAL mesh, for the properties panel.
//
// parts: parsed mesh part ids. Parts that no longer exist in the mesh (stale
// selection after an edit) are dropped.
// Returns {
//   faces: [{ faceIndex, area, vertexCount, holeCount, orientation }],
//   edges: [{ a, b, length, canMerge }],
// }
export default function getMesh3dPartsInfo(mesh, parts) {
  const faces = [];
  const edges = [];
  if (!mesh?.faces?.length) return { faces, edges };

  for (const part of parts || []) {
    if (part.partType === MESH3D_FACE_PART) {
      const face = mesh.faces[part.faceIndex];
      if (!face) continue;
      faces.push({
        faceIndex: part.faceIndex,
        area: getFaceArea(mesh.vertices, face),
        vertexCount: getFaceLoops(face).reduce((n, loop) => n + loop.length, 0),
        holeCount: face.holes?.length ?? 0,
        orientation: getMesh3dFaceOrientation(
          getFaceNormal(mesh.vertices, face)
        ),
      });
    } else if (part.partType === MESH3D_EDGE_PART) {
      const pa = mesh.vertices[part.a];
      const pb = mesh.vertices[part.b];
      if (!pa || !pb) continue;
      edges.push({
        a: part.a,
        b: part.b,
        length: length(sub(pb, pa)),
        canMerge: canMergeMesh3dFacesAtEdge(mesh, part.a, part.b),
      });
    }
  }
  return { faces, edges };
}
