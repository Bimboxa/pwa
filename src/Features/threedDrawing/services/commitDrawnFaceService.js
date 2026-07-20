import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import createAnnotationService from "Features/annotations/services/createAnnotationService";

import buildFaceAnnotationFields from "../utils/buildFaceAnnotationFields";
import buildVerticalBandPoints from "../utils/buildVerticalBandPoints";
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

// Match epsilon for reusing an existing db.points record on the same
// baseMap (in normalized [0..1] space). 5e-4 ≈ 0.5 mm at a 1 m image.
const POINT_REUSE_EPS = 5e-4;

// Persist `db.points` records and return the {id} references for an
// annotation. If a vertex's normalized (x, y) on the host baseMap matches
// an existing db.points within `POINT_REUSE_EPS`, that point is REUSED
// instead of a new one being created — so two faces that share a corner
// also share the underlying db.points and stay connected when the user
// later moves either one.
async function insertOrReusePoints({
  projectedPoints,
  baseMap,
  projectId,
  listingId,
}) {
  const existing = await db.points
    .where("baseMapId")
    .equals(baseMap.id)
    .toArray();
  const liveExisting = existing.filter((p) => !p.deletedAt);

  const pointRefs = [];
  await db.transaction("rw", db.points, async () => {
    for (const p of projectedPoints) {
      let matchId = null;
      for (const ep of liveExisting) {
        if (
          Math.abs(ep.x - p.x) < POINT_REUSE_EPS &&
          Math.abs(ep.y - p.y) < POINT_REUSE_EPS
        ) {
          matchId = ep.id;
          break;
        }
      }
      if (!matchId) {
        matchId = nanoid();
        await db.points.add({
          id: matchId,
          x: p.x,
          y: p.y,
          projectId,
          baseMapId: baseMap.id,
          listingId,
        });
        liveExisting.push({ id: matchId, x: p.x, y: p.y });
      }
      pointRefs.push({
        id: matchId,
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
//   - templateProps: the template-armed newAnnotation (template-driven mode);
//     null for the template-less ButtonDrawThreed entry (isPendingTemplate)
//   - entityId / layerId: linkage for the template-driven mode
//   - createAnnotationFn: useCreateAnnotation's fn — routes the templated
//     commit through mapping-category rels + update triggers; falls back to
//     the plain createAnnotationService when absent
//
// Returns the created annotation record, or null on failure (no host baseMap,
// degenerate geometry, etc.).
export default async function commitDrawnFaceService({
  cornersInOrder,
  baseMaps,
  projectId,
  listingId,
  templateProps = null,
  entityId = null,
  layerId = null,
  createAnnotationFn = null,
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
    annotationTemplateId: templateProps?.annotationTemplateId ?? null,
    // The pending-template flow only exists for the template-less entry
    // (ButtonDrawThreed); it lets the record pass createAnnotationService's
    // guard until the user assigns a template.
    ...(templateProps ? {} : { isPendingTemplate: true }),
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
