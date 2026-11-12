import collectSceneTriangles from "../js/collectSceneTriangles";
import collectVisibleFaceRegions from "../js/collectVisibleFaceRegions";
import clipRegionByCutLines from "../utils/clipRegionByCutLines";
import findFacePlanesAt from "../utils/findFacePlanesAt";
import { getCutLinesWorldPolylines } from "./cutLineObjectsStore";

// Dry run of the cut lines proposed by the AI chat (« Ligne de coupe –
// prompt IA »), nothing written: the visible face regions are clipped by the
// existing + proposed lines, like « Mailler » would, and the surfaces of the
// resulting groups of pieces (one maille each) are measured against the
// target.
//
// lines: [{ points: [{x,y,z}] }] world polylines (parseCutLinesPromptResult).
// Returns { pieceCount, maxPieceArea, overCount, offSurfaceCount } —
// overCount: pieces larger than maxArea; offSurfaceCount: points of the
// proposed lines lying on no face of the scene (within 5 mm).
export default function computeCutLinesPromptPreview({
  editor,
  angleDeg,
  lines,
  maxArea,
}) {
  const sceneManager = editor?.sceneManager;
  if (!sceneManager) return null;

  const triangles = collectSceneTriangles(sceneManager);
  let offSurfaceCount = 0;
  for (const line of lines || []) {
    for (const p of line.points) {
      if (!findFacePlanesAt(triangles, p).length) offSurfaceCount += 1;
    }
  }

  const cutLines = [
    ...getCutLinesWorldPolylines().map((l) => l.points),
    ...(lines || []).map((l) => l.points),
  ];
  let pieceCount = 0;
  let maxPieceArea = 0;
  let overCount = 0;
  // 1 cm² of slack: a piece exactly at the target is not "over".
  const limit = maxArea + 1e-4;
  for (const { soup } of collectVisibleFaceRegions(sceneManager, {
    angleDeg,
  })) {
    const clip = clipRegionByCutLines({
      positions: soup.positions,
      tris: soup.tris,
      cutLines,
    });
    for (const group of clip?.groups || []) {
      pieceCount += 1;
      if (group.area > maxPieceArea) maxPieceArea = group.area;
      if (group.area > limit) overCount += 1;
    }
  }
  return { pieceCount, maxPieceArea, overCount, offSurfaceCount };
}
