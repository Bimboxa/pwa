import collectVisibleFaceRegions from "Features/threedCutLines/js/collectVisibleFaceRegions";
import { isGroupCovered } from "Features/threedCutLines/services/createMeshesFromCutLinesService";
import { getCutLinesWorldPolylines } from "Features/threedCutLines/services/cutLineObjectsStore";
import buildMeshDataFromPieces from "Features/threedCutLines/utils/buildMeshDataFromPieces";
import clipRegionByCutLines from "Features/threedCutLines/utils/clipRegionByCutLines";

import groupAdjacentMeshes3d from "../utils/groupAdjacentMeshes3d";
import mergeMesh3dGeometries from "../utils/mergeMesh3dGeometries";

const SEED_ID = "__seed__";

// « Fusionner les faces adjacentes » (CREATE tool, « Ajouter une maille »):
// geometry of the maille made of the clicked piece (`seed`: { faces, shell })
// and of every FREE piece adjacent to it, transitively — as if a maille had
// been created on every free face of the visible annotations and « Fusionner
// les mailles adjacentes » had then been run, keeping only the group of the
// clicked one.
//
// - candidates: every group of pieces of every face region of the visible
//   annotations (collectVisibleFaceRegions, cut by the cut lines — the same
//   groups « Mailler » creates), except the ones an existing maille or the
//   seed already covers;
// - adjacency: groupAdjacentMeshes3d — a contact no cut line separates.
//   Existing mailles are not candidates: they are neither absorbed nor
//   crossed.
//
// `meshes3d`: the live mailles of the scope. Returns { faces, shell } — the
// seed's own geometry when nothing is adjacent to it.
export default function buildAdjacentFacesMeshData({
  sceneManager,
  angleDeg,
  seed,
  meshes3d,
}) {
  const seedData = { faces: seed?.faces || [], shell: seed?.shell || null };
  if (!sceneManager) return seedData;

  const cutLines = getCutLinesWorldPolylines().map((line) => line.points);
  const existing = (meshes3d || []).filter((r) => r && !r.deletedAt);
  const coveredFaces = [
    ...existing.flatMap((r) => r.faces || []),
    ...seedData.faces,
  ];
  const coveredShells = [
    ...existing.map((r) => r.shell),
    seedData.shell,
  ].filter((shell) => shell?.positions?.length);

  const candidates = [{ id: SEED_ID, ...seedData }];
  for (const { soup } of collectVisibleFaceRegions(sceneManager, {
    angleDeg,
  })) {
    const clip = clipRegionByCutLines({
      positions: soup.positions,
      tris: soup.tris,
      cutLines,
    });
    for (const group of clip?.groups || []) {
      const pieces = group.pieceIndices.map((i) => clip.pieces[i]);
      if (isGroupCovered(pieces, coveredFaces, coveredShells)) continue;
      const meshData = buildMeshDataFromPieces(pieces);
      if (!meshData?.faces?.length && !meshData?.shell?.positions?.length) {
        continue;
      }
      candidates.push({
        id: `candidate-${candidates.length}`,
        faces: meshData.faces || [],
        shell: meshData.shell || null,
      });
    }
  }
  if (candidates.length < 2) return seedData;

  const group = groupAdjacentMeshes3d(candidates, cutLines).find((rows) =>
    rows.some((row) => row.id === SEED_ID)
  );
  if (!group) return seedData;

  const geometry = mergeMesh3dGeometries(group);
  if (!geometry) return seedData;
  return { faces: geometry.faces, shell: geometry.shell };
}
