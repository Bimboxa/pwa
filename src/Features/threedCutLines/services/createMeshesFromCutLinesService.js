import db from "App/db/db";
import { getFaceRegion } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import collectAnnotationSectionMeshes from "Features/threedEditor/js/utilsClipping/collectAnnotationSectionMeshes";
import createMesh3dService from "Features/threedMesh/services/createMesh3dService";
import buildMeshDataFromRegion from "Features/threedMesh/utils/buildMeshDataFromRegion";
import computePlaneBasis from "Features/threedMesh/utils/computePlaneBasis";
import pointInPolygon2d from "Features/threedMesh/utils/pointInPolygon2d";
import { projectPointTo2d } from "Features/threedMesh/utils/planeProjection";

import clipFaceByCutLines from "../utils/clipFaceByCutLines";
import { getCutLinesWorldPolylines } from "./cutLineObjectsStore";

// Plane tolerances of the "already covered by a maille" test.
const COVER_NORMAL_DOT = 0.999;
const COVER_PLANE_TOL_M = 2e-3;

// « Créer le maillage » (Maillage module): one maille per piece of every
// planar face region of the visible annotation solids that the cut lines
// cross (clipFaceByCutLines). Faces no line crosses produce nothing; a piece
// whose centroid already lies inside an existing coplanar maille face is
// skipped (user decisions 2026-11-03). Curved regions (shells) are not
// clipped: skipped too. Each maille takes its source annotation's hue, like
// the CREATE tool.
//
// Returns { created, skippedCovered, facesCut }.
export default async function createMeshesFromCutLinesService({
  editor,
  projectId,
  scopeId,
  angleDeg,
}) {
  const sceneManager = editor?.sceneManager;
  if (!sceneManager || !projectId || !scopeId) {
    return { created: 0, skippedCovered: 0, facesCut: 0 };
  }
  const cutLines = getCutLinesWorldPolylines().map((l) => l.points);
  if (!cutLines.length) return { created: 0, skippedCovered: 0, facesCut: 0 };

  const existing = (
    await db.meshes3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray()
  ).filter((r) => !r.deletedAt);
  const existingFaces = existing.flatMap((r) => r.faces || []);

  const meshes = collectAnnotationSectionMeshes(
    sceneManager.annotationsManager,
    { visibleOnly: true }
  );

  let created = 0;
  let skippedCovered = 0;
  let facesCut = 0;
  const colorByAnnotationId = new Map();

  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const index = geometry?.index;
    const triCount = index
      ? index.count / 3
      : (geometry?.attributes?.position?.count ?? 0) / 3;
    if (!triCount) continue;
    const annotationId = findAnnotationId(mesh);
    if (!annotationId) continue;

    const assigned = new Uint8Array(triCount);
    for (let t = 0; t < triCount; t++) {
      if (assigned[t]) continue;
      const region = getFaceRegion(geometry, t, {
        plane: !!mesh.userData?.hasSubtraction,
        angleDeg,
      });
      if (!region?.tris?.length) {
        assigned[t] = 1;
        continue;
      }
      region.tris.forEach((i) => {
        assigned[i] = 1;
      });
      const meshData = buildMeshDataFromRegion(mesh, region.tris);
      const face = meshData?.faces?.length === 1 ? meshData.faces[0] : null;
      if (!face) continue;
      const clip = clipFaceByCutLines({ face, cutLines });
      if (!clip?.pieces?.length) continue;
      facesCut += 1;

      let baseColor = colorByAnnotationId.get(annotationId);
      if (baseColor === undefined) {
        const annotation = await db.annotations.get(annotationId);
        baseColor = annotation?.fillColor || annotation?.strokeColor || null;
        colorByAnnotationId.set(annotationId, baseColor);
      }

      for (const piece of clip.pieces) {
        if (isCoveredByExistingFace(piece, existingFaces)) {
          skippedCovered += 1;
          continue;
        }
        const row = await createMesh3dService({
          projectId,
          scopeId,
          faces: [
            {
              contour: piece.contour,
              holes: piece.holes,
              normal: piece.normal,
            },
          ],
          baseColor,
          sourceInfo: { annotationId, fromCutLines: true },
        });
        if (row) {
          created += 1;
          existingFaces.push(...(row.faces || []));
        }
      }
    }
  }
  return { created, skippedCovered, facesCut };
}

function findAnnotationId(mesh) {
  let node = mesh;
  while (node) {
    if (node.userData?.nodeType === "ANNOTATION" && node.userData.nodeId) {
      return node.userData.nodeId;
    }
    node = node.parent;
  }
  return null;
}

// The piece's centroid lies inside an existing face of the same plane.
function isCoveredByExistingFace(piece, faces) {
  const c = piece.centroid;
  const n = piece.normal;
  if (!c || !n) return false;
  for (const face of faces) {
    const fn = face?.normal;
    const contour = face?.contour;
    if (!fn || !contour?.length) continue;
    const dot = fn.x * n.x + fn.y * n.y + fn.z * n.z;
    if (Math.abs(dot) < COVER_NORMAL_DOT) continue;
    const a = contour[0];
    const d = fn.x * (c.x - a.x) + fn.y * (c.y - a.y) + fn.z * (c.z - a.z);
    if (Math.abs(d) > COVER_PLANE_TOL_M) continue;
    const basis = computePlaneBasis(fn, a);
    const c2 = projectPointTo2d(c, basis);
    const inContour = pointInPolygon2d(
      c2,
      contour.map((p) => projectPointTo2d(p, basis))
    );
    if (!inContour) continue;
    const inHole = (face.holes || []).some((hole) =>
      pointInPolygon2d(
        c2,
        hole.map((p) => projectPointTo2d(p, basis))
      )
    );
    if (!inHole) return true;
  }
  return false;
}
