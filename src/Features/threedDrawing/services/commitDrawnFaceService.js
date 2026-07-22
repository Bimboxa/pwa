import { nanoid } from "@reduxjs/toolkit";

import createAnnotationService from "Features/annotations/services/createAnnotationService";

import buildFaceAnnotationFields from "../utils/buildFaceAnnotationFields";
import buildVerticalBandPoints from "../utils/buildVerticalBandPoints";
import classifyFaceVsBaseMap from "../utils/classifyFaceVsBaseMap";
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

// Orchestrator: 3D coplanar face → host baseMap → 2D annotation.
//
// Inputs:
//   - cornersInOrder: ordered 3D vertices of the face (length >= 3)
//   - baseMaps: array of resolved BaseMap instances to choose host from
//   - projectId, listingId: ownership for the new annotation/points
//   - templateProps: the template-armed newAnnotation — required, since the
//     only entry point is the template row click in PopperMapListings
//   - entityId / layerId: linkage carried by the created annotation
//   - createAnnotationFn: useCreateAnnotation's fn — routes the commit
//     through mapping-category rels + update triggers; falls back to the
//     plain createAnnotationService when absent
//
// Returns the created annotation record, or null on failure (no template, no
// host baseMap, degenerate geometry, etc.).
export default async function commitDrawnFaceService({
  cornersInOrder,
  baseMaps,
  projectId,
  listingId,
  templateProps,
  entityId = null,
  layerId = null,
  createAnnotationFn = null,
}) {
  if (!cornersInOrder?.length || cornersInOrder.length < 3) return null;
  if (!baseMaps?.length) return null;
  if (!templateProps?.annotationTemplateId) return null;

  const host = pickHostBaseMap(cornersInOrder, baseMaps);
  if (!host) return null;

  const classification = classifyFaceVsBaseMap(cornersInOrder, host);
  if (!classification) return null;

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
      if (projectedPoints.length < 3) return null;
      annotationFields = buildFaceAnnotationFields({
        classifiedShape: "POLYGON",
        classificationFields: {
          type: "POLYGON",
          offsetZ: roundForDisplay(classification.offset),
          height: 0,
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
      if (!band) return null;
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
      if (projectedPoints.length < 3) return null;
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
      return null;
  }

  const pointRefs = await insertOrReusePoints({
    projectedPoints,
    baseMap: host,
    projectId,
    listingId,
  });

  const annotation = {
    id: nanoid(),
    projectId,
    listingId,
    baseMapId: host.id,
    annotationTemplateId: templateProps.annotationTemplateId,
    ...(entityId ? { entityId } : {}),
    ...(layerId ? { layerId } : {}),
    points: pointRefs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...annotationFields,
  };

  const create = createAnnotationFn ?? createAnnotationService;
  return await create(annotation);
}
