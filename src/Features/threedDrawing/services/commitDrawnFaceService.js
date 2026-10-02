import { nanoid } from "@reduxjs/toolkit";

import createAnnotationService from "Features/annotations/services/createAnnotationService";

import buildFaceAnnotationFields from "../utils/buildFaceAnnotationFields";
import buildVerticalBandPoints from "../utils/buildVerticalBandPoints";
import classifyFaceVsBaseMap from "../utils/classifyFaceVsBaseMap";
import isVerticalBandExact from "../utils/isVerticalBandExact";
import pickHostBaseMap from "../utils/pickHostBaseMap";
import roundForDisplay from "../utils/roundForDisplay";
import insertOrReusePoints from "./insertOrReusePoints";

const POINT_DEDUPE_EPS = 5e-4; // 0.05% of normalized space (≈ 0.5 mm at 1 m img)

function dedupeAdjacent(points, eps = POINT_DEDUPE_EPS) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < eps && Math.abs(last.y - p.y) < eps) {
      continue;
    }
    out.push(p);
  }
  // also collapse last==first (closed-ring duplicate)
  if (
    out.length > 1 &&
    Math.abs(out[0].x - out[out.length - 1].x) < eps &&
    Math.abs(out[0].y - out[out.length - 1].y) < eps
  ) {
    out.pop();
  }
  return out;
}

// Reason of a face commit that found no plan encoding for the face (see
// commitDrawnFace): the caller may fall back to a mesh sheet.
export const FACE_COMMIT_NO_2D_ENCODING = "NO_2D_ENCODING";

// Orchestrator: 3D coplanar face → host baseMap → 2D annotation.
//
// Inputs:
//   - cornersInOrder: ordered 3D vertices of the face (length >= 3)
//   - baseMaps: array of resolved BaseMap instances to choose host from
//   - projectId, listingId: ownership for the new annotation/points
//   - templateProps: the armed newAnnotation — a template draft (template
//     row click in PopperMapListings), or the template-less draft of the
//     "Dessin" tool (`isTemplateless` without annotationTemplateId): the
//     annotation then belongs to the base map + `scopeId` only, no template
//     nor listing, like a template-less annotation drawn in 2D
//   - layerId: layer carried by the created annotation
//   - createAnnotationFn: useCreateAnnotation's fn — routes the commit
//     through mapping-category rels + update triggers; falls back to the
//     plain createAnnotationService when absent
//
// Returns the created annotation record, or null on failure (no template, no
// host baseMap, degenerate geometry, etc.).
export default async function commitDrawnFaceService(args) {
  return (await commitDrawnFace(args)).annotation;
}

// Same commit, with the reason of a failure: { annotation } or
// { annotation: null, reason }. reason FACE_COMMIT_NO_2D_ENCODING: the face
// has no plan encoding — a template-less vertical face the band cannot
// reproduce (an L, a U...: isVerticalBandExact).
export async function commitDrawnFace({
  cornersInOrder,
  baseMaps,
  projectId,
  listingId,
  scopeId = null,
  templateProps,
  layerId = null,
  createAnnotationFn = null,
}) {
  // Aborted commits are silent for the caller (null annotation) — say why in
  // the console so a "nothing happened" report is diagnosable.
  const abort = (message, reason = "ABORTED") => {
    console.warn(`[threedDrawing] face commit aborted: ${message}`);
    return { annotation: null, reason };
  };

  if (!cornersInOrder?.length || cornersInOrder.length < 3)
    return abort(`needs 3+ corners (got ${cornersInOrder?.length ?? 0})`);
  if (!baseMaps?.length) return abort("no base maps available");
  const isTemplateless =
    Boolean(templateProps?.isTemplateless) &&
    !templateProps?.annotationTemplateId;
  if (!isTemplateless && !templateProps?.annotationTemplateId)
    return abort("no armed template (annotationTemplateId missing)");

  // Host resolution: a unanimous baseMapId carried by the drawn vertices
  // (PLANE snaps stamp it) wins over the centroid heuristic — with several
  // unplaced base maps stacked coplanar at the origin, pickHostBaseMap ties
  // on every candidate and would pick an arbitrary one, re-hosting the face
  // away from the plan the cursor actually snapped to.
  const carriedIds = new Set(
    cornersInOrder.map((v) => v.baseMapId).filter(Boolean)
  );
  let host = null;
  if (carriedIds.size === 1) {
    const id = carriedIds.values().next().value;
    host = baseMaps.find((b) => b.id === id) ?? null;
  }
  if (!host) host = pickHostBaseMap(cornersInOrder, baseMaps);
  if (!host)
    return abort("no host base map (projection failed on every base map)");

  const classification = classifyFaceVsBaseMap(cornersInOrder, host);
  if (!classification)
    return abort(`face vs base map ${host.id} classification failed`);

  let annotationFields;
  let projectedPoints;

  switch (classification.kind) {
    case "PARALLEL": {
      projectedPoints = dedupeAdjacent(
        classification.projected.map((p) => ({
          x: p.x,
          y: p.y,
          offsetBottom: 0,
          offsetTop: 0,
        }))
      );
      if (projectedPoints.length < 3)
        return abort("degenerate PARALLEL face after dedupe");
      annotationFields = buildFaceAnnotationFields({
        classifiedShape: "POLYGON",
        classificationFields: {
          type: "POLYGON",
          offsetZ: roundForDisplay(classification.offset),
          // 2D parity: a flat-on-plan commit takes the template's extrusion
          // height, like the same template drawn in the 2D editor.
          height: templateProps.height ?? 0,
        },
        templateProps,
      });
      break;
    }
    case "PERPENDICULAR": {
      // Vertical face (perpendicular to baseMap plane). Encoded as an OPEN
      // POLYLINE band — one point per unique plan position with per-vertex
      // offsetBottom/offsetTop wrapping the local z interval (see
      // buildVerticalBandPoints) — so triangles, gables and ribbons render
      // exactly instead of walking the cycle (which double-covered the band
      // and drew the full bounding rectangle).
      const band = buildVerticalBandPoints(classification.projected);
      if (!band) return abort("degenerate PERPENDICULAR band");
      // A template-less face has a fallback (a mesh sheet): never commit a
      // band that would fill another shape.
      if (isTemplateless && !isVerticalBandExact(classification.projected))
        return abort(
          "vertical face not encodable as a band",
          FACE_COMMIT_NO_2D_ENCODING
        );
      projectedPoints = band.points;
      annotationFields = buildFaceAnnotationFields({
        classifiedShape: "POLYLINE",
        classificationFields: {
          type: "POLYLINE",
          closeLine: false,
          offsetZ: band.offsetZ,
          height: band.height,
        },
        templateProps,
      });
      break;
    }
    case "OBLIQUE": {
      // Triangulator Z math (per docstring of triangulateAnnotationGeometry):
      //   top = verticalLift + height + offsetBottom + offsetTop
      // For a flat polygon (height = 0), both offsetBottom and offsetTop
      // contribute to the top face. We carry the per-vertex slope in
      // `offsetBottom` only and leave `offsetTop` at 0 — otherwise the same
      // value in both fields would double the Z lift.
      const offsets = classification.projected.map((p) => p.offset);
      const baseOffset = Math.min(...offsets);
      projectedPoints = dedupeAdjacent(
        classification.projected.map((p) => ({
          x: p.x,
          y: p.y,
          offsetBottom: roundForDisplay(p.offset - baseOffset),
          offsetTop: 0,
        }))
      );
      if (projectedPoints.length < 3)
        return abort("degenerate OBLIQUE face after dedupe");
      annotationFields = buildFaceAnnotationFields({
        classifiedShape: "POLYGON",
        classificationFields: {
          type: "POLYGON",
          offsetZ: roundForDisplay(baseOffset),
          height: 0,
        },
        templateProps,
      });
      break;
    }
    default:
      return abort(`unknown classification kind ${classification.kind}`);
  }

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
  };

  const create = createAnnotationFn ?? createAnnotationService;
  return { annotation: await create(annotation) };
}
