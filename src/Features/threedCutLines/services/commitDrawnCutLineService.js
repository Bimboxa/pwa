import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import createAnnotationService from "Features/annotations/services/createAnnotationService";
import getBaseMapNormalWorldFromRow from "Features/baseMaps/js/getBaseMapNormalWorldFromRow";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import buildCoteAnnotationFields from "Features/threedDrawing/utils/buildCoteAnnotationFields";
import dedupeAdjacentVertices from "Features/threedDrawing/utils/dedupeAdjacentVertices";
import resolveHostBaseMap from "Features/threedDrawing/utils/resolveHostBaseMap";

import collectSceneTriangles from "../js/collectSceneTriangles";
import encodeCutLineRefs from "../utils/encodeCutLineRefs";
import extendCutLine from "../utils/extendCutLine";
import { findFaceNormalAlong } from "../utils/findFacePlanesAt";

// Orchestrator of the cut line drawn in 3D (Maillage module): ordered world
// vertices → extension of both ends along the faces of the scene
// (extendCutLine on the visible annotation solids) → host base map → CUT_LINE
// annotation.
//
//   - `verticesInOrder`: [{x, y, z, baseMapId?, nodeId?, faceNormal?}] — the
//     drawing vertices (toDrawingVertex); `faceNormal` of the first / last
//     vertex (the face under the cursor when it was placed, facing the
//     camera) is the face the extension starts on. Without one, the scene
//     face holding the vertex (findFaceNormalAlong, 5 mm) is used; no face at
//     all → that end is not extended.
//   - encoding (encodeCutLineRefs): annotation.offsetZ = lowest vertex,
//     per-ref offsetBottom; ONE db.points row per vertex, never shared (a
//     riser keeps two rows) — pointId identifies a vertex (sub-selection,
//     « Stop » flag, drag).
//   - refs: { id, offsetBottom, derived?: true } — `derived` marks the
//     points the extension added (dashed segments while selected).
//
// Template-less by construction (DRAW_CUT_LINE): scope + host base map only,
// `createAnnotationFn` (useCreateAnnotation) required since
// createAnnotationService refuses annotations without a template.
//
// Returns the created annotation record, or null on failure.
export default async function commitDrawnCutLineService({
  editor,
  verticesInOrder,
  baseMaps,
  projectId,
  scopeId = null,
  templateProps = null,
  layerId = null,
  createAnnotationFn = null,
  preferredBaseMapId = null,
}) {
  if (!verticesInOrder || verticesInOrder.length < 2) {
    console.warn("[threedCutLines] commit aborted: fewer than 2 vertices");
    return null;
  }
  if (!baseMaps?.length) {
    console.warn("[threedCutLines] commit aborted: no base maps");
    return null;
  }

  const host = resolveHostBaseMap({
    vertices: verticesInOrder,
    baseMaps,
    preferredBaseMapId,
  });
  if (!host) {
    console.warn("[threedCutLines] commit aborted: no host base map");
    return null;
  }

  // Extension along the faces of the scene.
  const drawn = verticesInOrder.map((v) => ({ x: v.x, y: v.y, z: v.z }));
  const triangles = collectSceneTriangles(editor?.sceneManager);
  // The face under the cursor first; an end placed on the plan (no
  // annotation face under the cursor, e.g. at the foot of a wall) falls back
  // to the scene face holding it, as the rebuild does.
  const last = verticesInOrder.length - 1;
  const faceOf = (i, j) => {
    const v = verticesInOrder[i];
    if (v?.faceNormal) return { normal: v.faceNormal };
    return findFaceNormalAlong(triangles, drawn[i], {
      x: drawn[i].x - drawn[j].x,
      y: drawn[i].y - drawn[j].y,
      z: drawn[i].z - drawn[j].z,
    });
  };
  const extended = extendCutLine({
    drawn,
    startFace: faceOf(0, 1),
    endFace: faceOf(last, last - 1),
    triangles,
    // Plan the line is drawn on: an end arriving at the foot of a sheet
    // climbs it in the vertical plane of the segment.
    upNormal: getBaseMapNormalWorldFromRow(host),
  });
  const { points: worldPoints, derivedStart, derivedEnd } = extended;
  console.log(
    `[threedCutLines] extension: +${derivedStart} point(s) at start, +${derivedEnd} at end (${triangles.length} scene triangles)`
  );

  const projected = worldPoints.map((p, i) => {
    const proj = worldToBaseMapNormalized(p, host);
    if (!proj) return null;
    const derived = i < derivedStart || i >= worldPoints.length - derivedEnd;
    return derived ? { ...proj, derived: true } : proj;
  });
  if (projected.some((p) => !p)) {
    console.warn("[threedCutLines] commit aborted: projection failed");
    return null;
  }

  const { offsetZ, points } = encodeCutLineRefs(projected);
  const projectedPoints = dedupeAdjacentVertices(points);
  if (projectedPoints.length < 2) {
    console.warn(
      "[threedCutLines] commit aborted: fewer than 2 distinct vertices"
    );
    return null;
  }

  // One db.points row per vertex (never reused, never shared).
  const pointRefs = [];
  await db.transaction("rw", db.points, async () => {
    for (const p of projectedPoints) {
      const id = nanoid();
      await db.points.add({
        id,
        x: p.x,
        y: p.y,
        projectId,
        baseMapId: host.id,
      });
      pointRefs.push({
        id,
        offsetBottom: p.offsetBottom ?? 0,
        ...(p.derived ? { derived: true } : {}),
      });
    }
  });

  const annotationFields = buildCoteAnnotationFields({
    shape: "CUT_LINE",
    classificationFields: { type: "CUT_LINE", offsetZ, height: 0 },
    templateProps,
  });

  const annotation = {
    id: nanoid(),
    projectId,
    scopeId: scopeId ?? null,
    listingId: null,
    isTemplateless: true,
    baseMapId: host.id,
    ...(layerId ? { layerId } : {}),
    points: pointRefs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...annotationFields,
    isDrawnIn3d: true,
  };

  const create = createAnnotationFn ?? createAnnotationService;
  return await create(annotation);
}
