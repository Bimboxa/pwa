import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import createAnnotationService from "Features/annotations/services/createAnnotationService";
import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

import classifyFaceVsBaseMap from "../utils/classifyFaceVsBaseMap";
import pickHostBaseMap from "../utils/pickHostBaseMap";
import roundForDisplay from "../utils/roundForDisplay";

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

// Persist `db.points` records and return the {id} references for an annotation.
async function insertPoints({
  projectedPoints,
  baseMap,
  projectId,
  listingId,
}) {
  const pointRefs = [];
  await db.transaction("rw", db.points, async () => {
    for (const p of projectedPoints) {
      const id = nanoid();
      await db.points.add({
        id,
        x: p.x,
        y: p.y,
        projectId,
        baseMapId: baseMap.id,
        listingId,
      });
      pointRefs.push({
        id,
        type: "square",
        offsetBottom: p.offsetBottom ?? 0,
        offsetTop: p.offsetTop ?? 0,
      });
    }
  });
  return pointRefs;
}

// Orchestrator: 3D coplanar face → host baseMap → 2D annotation.
//
// Inputs:
//   - cornersInOrder: ordered 3D vertices of the face (length >= 3)
//   - baseMaps: array of resolved BaseMap instances to choose host from
//   - projectId, listingId: ownership for the new annotation/points
//
// Returns the created annotation record, or null on failure (no host baseMap,
// degenerate geometry, etc.).
export default async function commitDrawnFaceService({
  cornersInOrder,
  baseMaps,
  projectId,
  listingId,
}) {
  if (!cornersInOrder?.length || cornersInOrder.length < 3) return null;
  if (!baseMaps?.length) return null;

  const host = pickHostBaseMap(cornersInOrder, baseMaps);
  if (!host) return null;

  const classification = classifyFaceVsBaseMap(cornersInOrder, host);
  if (!classification) return null;

  let annotationFields;
  let projectedPoints;

  switch (classification.kind) {
    case "PARALLEL": {
      const polygonDefaults = getDefaultsForShape("POLYGON");
      projectedPoints = dedupeAdjacent(
        classification.projected.map((p) => ({
          x: p.x,
          y: p.y,
          offsetBottom: 0,
          offsetTop: 0,
        }))
      );
      if (projectedPoints.length < 3) return null;
      annotationFields = {
        type: "POLYGON",
        offsetZ: roundForDisplay(classification.offset),
        height: 0,
        ...polygonDefaults,
      };
      break;
    }
    case "PERPENDICULAR": {
      // Vertical face (perpendicular to baseMap plane). Renders as a closed
      // POLYLINE walking the face's cycle, with per-vertex `offsetTop` so the
      // top edge follows the actual 3D geometry. extrudePolylineWall builds
      // one quad per cycle segment; degenerate ones (sol-à-sol or stacked
      // vertically) collapse to triangles or zero-area, which is exactly
      // what we want for ribbons (rectangles), vertical triangles, vertical
      // N-gons, etc.
      const polylineDefaults = getDefaultsForShape("POLYLINE");
      const offsets = classification.projected.map((p) => p.offset);
      const minOffset = Math.min(...offsets);
      const maxOffset = Math.max(...offsets);
      const wallHeight = maxOffset - minOffset;
      projectedPoints = classification.projected.map((p) => ({
        x: p.x,
        y: p.y,
        offsetBottom: 0,
        offsetTop: roundForDisplay(p.offset - maxOffset),
      }));
      if (projectedPoints.length < 2) return null;
      annotationFields = {
        type: "POLYLINE",
        closeLine: true,
        offsetZ: roundForDisplay(minOffset),
        height: roundForDisplay(wallHeight),
        ...polylineDefaults,
      };
      break;
    }
    case "OBLIQUE": {
      const polygonDefaults = getDefaultsForShape("POLYGON");
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
      annotationFields = {
        type: "POLYGON",
        offsetZ: roundForDisplay(baseOffset),
        height: 0,
        ...polygonDefaults,
      };
      break;
    }
    default:
      return null;
  }

  const pointRefs = await insertPoints({
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
    annotationTemplateId: null,
    isPendingTemplate: true,
    points: pointRefs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...annotationFields,
  };

  return await createAnnotationService(annotation);
}
