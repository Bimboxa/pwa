import {
  deleteMesh3dFaces,
  mergeMesh3dFacesAtEdge,
} from "../utils/editMesh3dParts";
import { MESH3D_EDGE_PART, MESH3D_FACE_PART } from "../utils/mesh3dPartIds";
import loadStoredMesh3d from "./loadStoredMesh3d";
import writeMesh3dService from "./writeMesh3dService";

// Deletes the selected parts of an annotation mesh.
//
// - faces: removed from the mesh, which stays open where they were;
// - an edge (only when no face is selected): dissolved, the two coplanar
//   faces it separates become one again — the reverse of a drawn line. An
//   edge between two planes holds the solid together and is left alone.
//
// parts: parsed part ids (parseMesh3dPartId). Returns
//   { ok: true } | { ok: false, reason: "LAST_FACE" | "EDGE_NOT_MERGEABLE" |
//   "NOT_FOUND" }.
// The part selection is cleared on success (writeMesh3dService): the write
// renumbers the mesh.
export default async function deleteMesh3dPartsService({
  annotationId,
  parts,
  dispatch,
}) {
  const ctx = await loadStoredMesh3d(annotationId);
  if (!ctx || !parts?.length) return { ok: false, reason: "NOT_FOUND" };

  const faceIndices = parts
    .filter((part) => part.partType === MESH3D_FACE_PART)
    .map((part) => part.faceIndex)
    .filter((i) => ctx.mesh.faces[i]);
  const edges = parts.filter((part) => part.partType === MESH3D_EDGE_PART);

  let mesh = null;
  if (faceIndices.length) {
    mesh = deleteMesh3dFaces(ctx.mesh, faceIndices);
    if (!mesh) return { ok: false, reason: "LAST_FACE" };
  } else if (edges.length) {
    // One edge at a time: each merge renumbers the mesh, so the next edge is
    // looked up again by the POSITIONS of its two vertices.
    mesh = ctx.mesh;
    let merged = 0;
    for (const edge of edges) {
      const pa = ctx.mesh.vertices[edge.a];
      const pb = ctx.mesh.vertices[edge.b];
      if (!pa || !pb) continue;
      const find = (p) =>
        mesh.vertices.findIndex(
          (q) =>
            Math.abs(q.x - p.x) < 1e-9 &&
            Math.abs(q.y - p.y) < 1e-9 &&
            Math.abs(q.z - p.z) < 1e-9
        );
      const a = find(pa);
      const b = find(pb);
      if (a < 0 || b < 0) continue; // already gone with a previous merge
      const next = mergeMesh3dFacesAtEdge(mesh, a, b);
      if (!next) continue;
      mesh = next;
      merged++;
    }
    if (!merged) return { ok: false, reason: "EDGE_NOT_MERGEABLE" };
  } else {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const written = await writeMesh3dService({
    annotation: ctx.annotation,
    mesh,
    baseOffsetZ: ctx.baseOffsetZ,
    metrics: ctx.metrics,
    dispatch,
  });
  if (!written) return { ok: false, reason: "NOT_FOUND" };
  return { ok: true };
}
