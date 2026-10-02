import { nanoid } from "@reduxjs/toolkit";

import createAnnotationService from "Features/annotations/services/createAnnotationService";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import buildFaceAnnotationFields from "../utils/buildFaceAnnotationFields";
import pickHostBaseMap from "../utils/pickHostBaseMap";
import roundForDisplay from "../utils/roundForDisplay";
import insertOrReusePoints from "./insertOrReusePoints";

const POINT_DEDUPE_EPS = 5e-4; // 0.05% of normalized space
const OFFSET_EPS_M = 5e-3; // 5 mm — parallel-to-plane tolerance

function dedupeAdjacent(points, { collapseClosingDuplicate } = {}) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.x - p.x) < POINT_DEDUPE_EPS &&
      Math.abs(last.y - p.y) < POINT_DEDUPE_EPS
    ) {
      continue;
    }
    out.push(p);
  }
  // An OPEN polyline may legitimately end near its start — only collapse the
  // last==first duplicate when the line is explicitly closed.
  if (
    collapseClosingDuplicate &&
    out.length > 1 &&
    Math.abs(out[0].x - out[out.length - 1].x) < POINT_DEDUPE_EPS &&
    Math.abs(out[0].y - out[out.length - 1].y) < POINT_DEDUPE_EPS
  ) {
    out.pop();
  }
  return out;
}

// Sibling of commitDrawnFaceService for OPEN polylines (and closed ones via
// `closeLine`): ordered 3D vertices → host baseMap → 2D POLYLINE annotation.
//
// Offset handling:
//   - all vertices within OFFSET_EPS_M of one plane-parallel level →
//     offsetZ = mean, and (2D parity) the template's extrusion `height` is
//     applied, like the same template drawn in the 2D editor
//   - otherwise → per-vertex offsetBottom relative to the lowest vertex
//     (same convention as the face service's OBLIQUE branch)
//
// Inputs mirror commitDrawnFaceService; `verticesInOrder` items are
// {x, y, z, baseMapId?} — a unanimous carried baseMapId wins over the
// centroid heuristic for host resolution.
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
// { annotation: null, reason }. reason POLYLINE_COMMIT_NO_2D_ENCODING (template-
// less line only): two consecutive vertices stand at the same plan position
// at different heights — a vertical stretch the plan points cannot hold.
export const POLYLINE_COMMIT_NO_2D_ENCODING = "NO_2D_ENCODING";

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

  const carriedIds = new Set(
    verticesInOrder.map((v) => v.baseMapId).filter(Boolean)
  );
  let host = null;
  if (carriedIds.size === 1) {
    const id = carriedIds.values().next().value;
    host = baseMaps.find((b) => b.id === id) ?? null;
  }
  if (!host) host = pickHostBaseMap(verticesInOrder, baseMaps);
  if (!host)
    return abort("no host base map (projection failed on every base map)");

  const projected = verticesInOrder.map((v) =>
    worldToBaseMapNormalized(v, host)
  );
  if (projected.some((p) => !p))
    return abort(`projection on base map ${host.id} failed`);

  // Template-less line: a vertical stretch would silently collapse in the
  // dedupe below — refuse it instead of committing another line.
  if (isTemplateless) {
    const count = closeLine ? projected.length : projected.length - 1;
    for (let i = 0; i < count; i++) {
      const p = projected[i];
      const q = projected[(i + 1) % projected.length];
      if (
        Math.abs(p.x - q.x) < POINT_DEDUPE_EPS &&
        Math.abs(p.y - q.y) < POINT_DEDUPE_EPS &&
        Math.abs(p.offset - q.offset) > OFFSET_EPS_M
      ) {
        return abort(
          "vertical stretch, no plan encoding",
          POLYLINE_COMMIT_NO_2D_ENCODING
        );
      }
    }
  }

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
      height: templateProps.height ?? 0,
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

  projectedPoints = dedupeAdjacent(projectedPoints, {
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
  };

  const create = createAnnotationFn ?? createAnnotationService;
  return { annotation: await create(annotation) };
}
