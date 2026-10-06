import { MESH3D_EDGE_PART, MESH3D_FACE_PART } from "./mesh3dPartIds.js";
import remapMesh3dParts from "./remapMesh3dParts.js";

// Plan footprint quantization: 1 mm.
const FOOTPRINT_MM = 1000;

const footprintKey = (v) =>
  `${Math.round(v.x * FOOTPRINT_MM)},${Math.round(v.y * FOOTPRINT_MM)}`;

// Sorted multiset of the XY-quantized vertices of a face (contour + holes).
function faceFootprint(mesh, face) {
  const loops = [face.loop, ...(face.holes || [])];
  return loops
    .flatMap((loop) => loop.map((vi) => footprintKey(mesh.vertices[vi])))
    .sort()
    .join("|");
}

function faceMeanZ(mesh, face) {
  let sum = 0;
  let n = 0;
  for (const vi of face.loop) {
    sum += mesh.vertices[vi].z;
    n++;
  }
  return n ? sum / n : 0;
}

// Parts (faces / edges) selected on one displayed mesh, re-located on the
// NEXT displayed mesh of the same annotation after a VERTICAL edit (a point
// offset, a height change): a face is the one with the same plan footprint
// (multiset of XY-quantized vertices, z ignored) — the nearest mean z wins
// between a prism's top and bottom; an edge the one whose ends have the same
// XY. Parts found no other way fall back on remapMesh3dParts (by geometry);
// parts still not found are dropped, duplicates merged.
//
// fromMesh / toMesh: LOCAL meshes, same frame. parts: parsed part ids.
// Returns parts of the same shape, addressing `toMesh`.
//
// Pure (no three.js): node-testable.
export default function relocateMesh3dPartsByFootprint(
  fromMesh,
  toMesh,
  parts
) {
  if (!fromMesh || !toMesh) return [];

  const facesByFootprint = new Map();
  toMesh.faces.forEach((face, i) => {
    if (!(face?.loop?.length >= 3)) return;
    const key = faceFootprint(toMesh, face);
    if (!facesByFootprint.has(key)) facesByFootprint.set(key, []);
    facesByFootprint.get(key).push(i);
  });
  const toVertexByFootprint = new Map();
  toMesh.vertices.forEach((v, i) => {
    const key = footprintKey(v);
    if (!toVertexByFootprint.has(key)) toVertexByFootprint.set(key, []);
    toVertexByFootprint.get(key).push(i);
  });

  const result = [];
  const seen = new Set();
  const fallback = [];
  const push = (part, key) => {
    if (seen.has(key)) return;
    seen.add(key);
    result.push(part);
  };

  for (const part of parts || []) {
    if (part.partType === MESH3D_FACE_PART) {
      const face = fromMesh.faces[part.faceIndex];
      if (!(face?.loop?.length >= 3)) continue;
      const candidates =
        facesByFootprint.get(faceFootprint(fromMesh, face)) || [];
      if (!candidates.length) {
        fallback.push(part);
        continue;
      }
      const z = faceMeanZ(fromMesh, face);
      let best = candidates[0];
      let bestDz = Infinity;
      for (const i of candidates) {
        const dz = Math.abs(faceMeanZ(toMesh, toMesh.faces[i]) - z);
        if (dz < bestDz) {
          bestDz = dz;
          best = i;
        }
      }
      push({ ...part, faceIndex: best }, `F${best}`);
    } else if (part.partType === MESH3D_EDGE_PART) {
      const pa = fromMesh.vertices[part.a];
      const pb = fromMesh.vertices[part.b];
      if (!pa || !pb) continue;
      const nearest = (p, exclude) => {
        let best = -1;
        let bestDz = Infinity;
        for (const i of toVertexByFootprint.get(footprintKey(p)) || []) {
          if (i === exclude) continue;
          const dz = Math.abs(toMesh.vertices[i].z - p.z);
          if (dz < bestDz) {
            bestDz = dz;
            best = i;
          }
        }
        return best;
      };
      const va = nearest(pa, -1);
      const vb = nearest(pb, va);
      if (va < 0 || vb < 0) {
        fallback.push(part);
        continue;
      }
      const [lo, hi] = va < vb ? [va, vb] : [vb, va];
      push({ ...part, a: lo, b: hi }, `E${lo}_${hi}`);
    }
  }

  for (const part of remapMesh3dParts(fromMesh, toMesh, fallback)) {
    const key =
      part.partType === MESH3D_FACE_PART
        ? `F${part.faceIndex}`
        : `E${part.a}_${part.b}`;
    push(part, key);
  }
  return result;
}
