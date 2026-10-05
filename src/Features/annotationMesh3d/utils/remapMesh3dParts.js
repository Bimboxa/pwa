import {
  add,
  cross,
  length,
  normalize,
  scale,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import locateFaceNearHit from "./locateFaceNearHit.js";
import { MESH3D_EDGE_PART, MESH3D_FACE_PART } from "./mesh3dPartIds.js";
import { getFaceNormal } from "./mesh3dTopology.js";

// How far the probe point of a face is pushed inside it, off its first edge.
const INSET_M = 0.001;

// Parts (faces / edges) selected on one mesh, re-located BY GEOMETRY on
// another mesh of the same solid — the displayed (possibly shrunk) conversion
// of a regular annotation vs the un-shrunk one that gets written: faces sit
// up to 10 mm apart and nothing guarantees the same numbering.
//
// - face: the face of `toMesh` parallel to it, looking the same way, whose
//   outline holds a point taken just inside the source face;
// - edge: the two vertices of `toMesh` nearest to its ends.
// Parts that cannot be found are dropped; duplicates are merged.
//
// fromMesh / toMesh: LOCAL meshes, same frame. parts: parsed part ids.
// Returns parts of the same shape, addressing `toMesh`.
//
// Pure (no three.js): node-testable.
export default function remapMesh3dParts(
  fromMesh,
  toMesh,
  parts,
  maxDistM = 0.025
) {
  if (!fromMesh || !toMesh) return [];

  const nearestVertex = (p) => {
    let best = -1;
    let bestDist = maxDistM;
    toMesh.vertices.forEach((q, i) => {
      const d = length(sub(q, p));
      if (d <= bestDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  };

  const result = [];
  const seen = new Set();
  for (const part of parts || []) {
    if (part.partType === MESH3D_FACE_PART) {
      const face = fromMesh.faces[part.faceIndex];
      if (!(face?.loop?.length >= 3)) continue;
      const normal = getFaceNormal(fromMesh.vertices, face);
      const a = fromMesh.vertices[face.loop[0]];
      const b = fromMesh.vertices[face.loop[1]];
      // The loop runs counter-clockwise around the normal: normal × edge
      // points inside the face.
      const inward = normalize(cross(normal, sub(b, a)));
      const point = add(scale(add(a, b), 0.5), scale(inward, INSET_M));
      const faceIndex = locateFaceNearHit(toMesh, point, normal, maxDistM, {
        rayDir: scale(normal, -1),
      });
      if (faceIndex < 0 || seen.has(`F${faceIndex}`)) continue;
      seen.add(`F${faceIndex}`);
      result.push({ ...part, faceIndex });
    } else if (part.partType === MESH3D_EDGE_PART) {
      const pa = fromMesh.vertices[part.a];
      const pb = fromMesh.vertices[part.b];
      if (!pa || !pb) continue;
      const va = nearestVertex(pa);
      const vb = nearestVertex(pb);
      if (va < 0 || vb < 0 || va === vb) continue;
      const [lo, hi] = va < vb ? [va, vb] : [vb, va];
      if (seen.has(`E${lo}_${hi}`)) continue;
      seen.add(`E${lo}_${hi}`);
      result.push({ ...part, a: lo, b: hi });
    }
  }
  return result;
}
