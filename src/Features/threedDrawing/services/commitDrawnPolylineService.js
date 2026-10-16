import { nanoid } from "@reduxjs/toolkit";

import createAnnotationService from "Features/annotations/services/createAnnotationService";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import buildFaceAnnotationFields from "../utils/buildFaceAnnotationFields";
import dedupeAdjacentVertices from "../utils/dedupeAdjacentVertices";
import resolveHostBaseMap from "../utils/resolveHostBaseMap";
import roundForDisplay from "../utils/roundForDisplay";
import insertOrReusePoints from "./insertOrReusePoints";

const OFFSET_EPS_M = 5e-3; // 5 mm — parallel-to-plane tolerance

// Sibling of commitDrawnFaceService for OPEN polylines (and closed ones via
// `closeLine`): ordered 3D vertices → host baseMap → 2D POLYLINE annotation.
//
// Offset handling:
//   - all vertices within OFFSET_EPS_M of one plane-parallel level →
//     offsetZ = mean, and (2D parity) the template's extrusion `height` is
//     applied, like the same template drawn in the 2D editor
//   - otherwise → per-vertex offsetBottom relative to the lowest vertex
//     (same convention as the face service's OBLIQUE branch). A vertical
//     segment (two consecutive vertices at the same plan position) is kept
//     as two consecutive refs to the same db.points id with different
//     offsetBottom — extrudePolylineWall draws it as a vertical line.
//
// Inputs mirror commitDrawnFaceService; `verticesInOrder` items are
// {x, y, z, baseMapId?} — a unanimous carried baseMapId wins, then the
// base map selected in 2D (`preferredBaseMapId`), then the centroid
// heuristic (resolveHostBaseMap).
//
// Templateless draft (3D "Dessin" tool, `templateProps.isTemplateless`
// without annotationTemplateId): the annotation belongs to the base map +
// `scopeId` only, no template nor listing, like a templateless annotation
// drawn in 2D.
//
// Returns the created annotation record, or null on failure.
export default async function commitDrawnPolylineService(args) {
  return (await commitDrawnPolyline(args)).annotation;
}

// Same commit, with the reason of a failure: { annotation } or
// { annotation: null, reason }.
export async function commitDrawnPolyline({
  verticesInOrder,
  baseMaps,
  projectId,
  listingId,
  templateProps,
  layerId = null,
  createAnnotationFn = null,
  closeLine = false,
  scopeId = null,
  // The base map selected in 2D (resolveHostBaseMap).
  preferredBaseMapId = null,
  // See commitDrawnFace: a painted edge stays a flat line (no template
  // extrusion height); extraFields are spread last (provenance markers…).
  ignoreTemplateHeight = false,
  extraFields = null,
}) {
  // Aborted commits are silent for the caller (null annotation) — say why in
  // the console so a "nothing happened" report is diagnosable.
  const abort = (message, reason = "ABORTED") => {
    console.warn(`[threedDrawing] polyline commit aborted: ${message}`);
    return { annotation: null, reason };
  };

  if (!verticesInOrder?.length || verticesInOrder.length < 2)
    return abort(`needs 2+ vertices (got ${verticesInOrder?.length ?? 0})`);
  if (!baseMaps?.length) return abort("no base maps available");
  const isTemplateless =
    Boolean(templateProps?.isTemplateless) &&
    !templateProps?.annotationTemplateId;
  if (!isTemplateless && !templateProps?.annotationTemplateId)
    return abort("no armed template (annotationTemplateId missing)");

  const host = resolveHostBaseMap({
    vertices: verticesInOrder,
    baseMaps,
    preferredBaseMapId,
  });
  if (!host)
    return abort("no host base map (projection failed on every base map)");

  const projected = verticesInOrder.map((v) =>
    worldToBaseMapNormalized(v, host)
  );
  if (projected.some((p) => !p))
    return abort(`projection on base map ${host.id} failed`);

  const offsets = projected.map((p) => p.offset);
  const minO = Math.min(...offsets);
  const maxO = Math.max(...offsets);
  const isParallel = maxO - minO < OFFSET_EPS_M;

  let projectedPoints;
  let classificationFields;
  if (isParallel) {
    projectedPoints = projected.map((p) => ({
      x: p.x,
      y: p.y,
      offsetBottom: 0,
      offsetTop: 0,
    }));
    classificationFields = {
      type: "POLYLINE",
      closeLine,
      offsetZ: roundForDisplay((minO + maxO) / 2),
      height: ignoreTemplateHeight ? 0 : (templateProps.height ?? 0),
    };
  } else {
    projectedPoints = projected.map((p) => ({
      x: p.x,
      y: p.y,
      offsetBottom: roundForDisplay(p.offset - minO),
      offsetTop: 0,
    }));
    classificationFields = {
      type: "POLYLINE",
      closeLine,
      offsetZ: roundForDisplay(minO),
      height: 0,
    };
  }

  projectedPoints = dedupeAdjacentVertices(projectedPoints, {
    collapseClosingDuplicate: closeLine,
  });
  if (projectedPoints.length < 2)
    return abort("degenerate polyline after dedupe");

  const annotationFields = buildFaceAnnotationFields({
    classifiedShape: "POLYLINE",
    classificationFields,
    templateProps,
  });

  const pointRefs = await insertOrReusePoints({
    projectedPoints,
    baseMap: host,
    projectId,
    listingId: isTemplateless ? undefined : listingId,
  });

  const annotation = {
    id: nanoid(),
    projectId,
    ...(isTemplateless
      ? { scopeId: scopeId ?? null, listingId: null }
      : {
          listingId,
          annotationTemplateId: templateProps.annotationTemplateId,
        }),
    baseMapId: host.id,
    ...(layerId ? { layerId } : {}),
    points: pointRefs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...annotationFields,
    ...(extraFields ?? {}),
  };

  const create = createAnnotationFn ?? createAnnotationService;
  return { annotation: await create(annotation) };
}
