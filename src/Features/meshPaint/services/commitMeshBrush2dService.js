import { nanoid } from "@reduxjs/toolkit";
import { Vector3 } from "three";

import store from "App/store";
import { withUndoGroup } from "App/db/undoManager";

import { removeShrinkExemptAnnotationIds } from "Features/meshPaint/meshPaintSlice";

import collectGroundPolygonsFromScene from "Features/meshPaint/services/collectGroundPolygonsFromScene";
import { isShrinkableAnnotation } from "Features/meshPaint/services/ensureUnshrunkHostObject";
import buildWallBandAnnotationFields from "Features/meshPaint/utils/buildWallBandAnnotationFields";
import classifyMeshBrushLocalPart, {
  BRUSH_2D_KIND,
} from "Features/meshPaint/utils/classifyMeshBrushLocalPart";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import matchWallFaceToGroundPolygons from "Features/meshPaint/utils/matchWallFaceToGroundPolygons";
import { commitDrawnFace } from "Features/threedDrawing/services/commitDrawnFaceService";
import { commitDrawnPolyline } from "Features/threedDrawing/services/commitDrawnPolylineService";
import insertOrReusePoints from "Features/threedDrawing/services/insertOrReusePoints";
import buildFaceAnnotationFields from "Features/threedDrawing/utils/buildFaceAnnotationFields";

// « Pinceau » → 2D annotation (mapEditor.meshBrushCreate2dIfPossible): the
// picked part of a host, re-detected on the un-shrunk object
// (commitMeshBrushTargetService), becomes a regular annotation of the armed
// template when the plan can hold it, instead of a db.meshPaints row.
//
//   WALL_BAND   lateral facet of a thick wall: one vertical POLYLINE band per
//               run of floor polygon sub-edges glued to the facet's foot on
//               the painted side (matchWallFaceToGroundPolygons), bottom =
//               the floor (+ ramp), top = the facet's top. No run → NO_GROUND
//               (the caller shows a toaster, nothing is written — the paint
//               row is NOT a fallback there).
//   FACE_2D     commitDrawnFace in strict mode (PARALLEL polygon with cuts,
//               exact vertical band, oblique polygon) → else FALLBACK.
//   POLYLINE_2D commitDrawnPolyline (horizontal edge) → else FALLBACK.
//   PAINT       FALLBACK (curved / multi-polygon facet, sloped edge).
//
// Created annotations: the armed template + its listing, the host's layer,
// `autoCreatedFrom: hostId` + `autoGenKind: "MESH_BRUSH"` (provenance only:
// they are independent of the host, unlike a paint row). One click = one
// undo step (withUndoGroup). On success the host's session shrink exemption
// is dropped (the band sits flush on the facet).
//
// Returns { status: "CREATED", annotationIds }
//       | { status: "NO_GROUND" }
//       | { status: "FALLBACK", reason }.

export const BRUSH_2D_STATUS = Object.freeze({
  CREATED: "CREATED",
  NO_GROUND: "NO_GROUND",
  FALLBACK: "FALLBACK",
});

export const MESH_BRUSH_AUTO_GEN_KIND = "MESH_BRUSH";

// Glue tolerance between a floor polygon edge and the wall facet (m).
const GROUND_GLUE_TOL_M = 0.05;

const fallback = (reason) => ({ status: BRUSH_2D_STATUS.FALLBACK, reason });

export default async function commitMeshBrush2dService({
  editor,
  partType,
  hostId,
  baseMapId,
  localGeometry,
  host,
  template,
  templateProps,
  baseMaps,
  projectId,
  createAnnotationFn = null,
}) {
  const sceneManager = editor?.sceneManager;
  const imagesManager = sceneManager?.imagesManager;
  const annotationsManager = sceneManager?.annotationsManager;
  const group = imagesManager?.getGroup?.(baseMapId);
  const baseMap = imagesManager?.baseMapsMap?.[baseMapId];
  const metrics = getMeshPaintMetrics(baseMap);
  if (!group || !baseMap || !metrics) return fallback("NO_BASE_MAP");
  if (!template?.id || !templateProps?.annotationTemplateId)
    return fallback("NO_TEMPLATE");

  const source = annotationsManager?.getAnnotationSource?.(hostId) ?? host;
  const plan = classifyMeshBrushLocalPart(partType, localGeometry, {
    isThickWallHost: isShrinkableAnnotation(source),
  });
  if (plan.kind === BRUSH_2D_KIND.PAINT) return fallback(plan.reason);

  const listingId = template.listingId ?? templateProps.listingId ?? null;
  const layerId = host?.layerId ?? null;
  const extraFields = {
    autoCreatedFrom: hostId,
    autoGenKind: MESH_BRUSH_AUTO_GEN_KIND,
  };
  const common = {
    baseMaps: baseMaps || [],
    projectId,
    listingId,
    templateProps,
    layerId,
    createAnnotationFn,
    extraFields,
  };

  group.updateWorldMatrix(true, false);
  const toWorld = (p) => {
    const v = group.localToWorld(new Vector3(p.x, p.y, p.z));
    return { x: v.x, y: v.y, z: v.z, baseMapId };
  };

  let result;
  if (plan.kind === BRUSH_2D_KIND.WALL_BAND) {
    result = await commitWallBand({
      plan,
      annotationsManager,
      metrics,
      baseMap,
      hostId,
      template,
      ...common,
    });
  } else if (plan.kind === BRUSH_2D_KIND.FACE_2D) {
    const [polygon] = localGeometry.polygons;
    result = await withUndoGroup(async () => {
      const { annotation, reason } = await commitDrawnFace({
        cornersInOrder: polygon.contour.map(toWorld),
        holes: (polygon.holes || []).map((hole) => hole.map(toWorld)),
        strict: true,
        ignoreTemplateHeight: true,
        ...common,
      });
      return annotation
        ? { status: BRUSH_2D_STATUS.CREATED, annotationIds: [annotation.id] }
        : fallback(reason ?? "NO_2D_ENCODING");
    });
  } else {
    const points = localGeometry.points || [];
    const vertices = (plan.closeLine ? points.slice(0, -1) : points).map(
      toWorld
    );
    result = await withUndoGroup(async () => {
      const { annotation, reason } = await commitDrawnPolyline({
        verticesInOrder: vertices,
        closeLine: Boolean(plan.closeLine),
        ignoreTemplateHeight: true,
        ...common,
      });
      return annotation
        ? { status: BRUSH_2D_STATUS.CREATED, annotationIds: [annotation.id] }
        : fallback(reason ?? "NO_2D_ENCODING");
    });
  }

  if (result.status === BRUSH_2D_STATUS.CREATED) {
    store.dispatch(removeShrinkExemptAnnotationIds([hostId]));
  }
  return result;
}

// base-map-local meters → image pixels (mesh3dFrame conventions; y flips).
function localToPx({ x, y }, { imageWidth, imageHeight, meterByPx }) {
  return {
    x: x / meterByPx + imageWidth / 2,
    y: -y / meterByPx + imageHeight / 2,
  };
}

async function commitWallBand({
  plan,
  annotationsManager,
  metrics,
  baseMap,
  hostId,
  template,
  baseMaps,
  projectId,
  listingId,
  templateProps,
  layerId,
  createAnnotationFn,
  extraFields,
}) {
  const a = localToPx(plan.footprint.a, metrics);
  const b = localToPx(plan.footprint.b, metrics);
  const n = plan.sideNormal2d;
  const guideEdges = [
    {
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      nx: n.x,
      ny: -n.y,
      topZ: plan.topZ,
      wallHeight: plan.topZ,
      bottomZ: 0,
    },
  ];
  const polygons = collectGroundPolygonsFromScene({
    annotationsManager,
    baseMapId: baseMap.id,
    hostId,
    armedTemplateId: template.id,
    meterByPx: metrics.meterByPx,
  });
  const runs = matchWallFaceToGroundPolygons({
    guideEdges,
    polygons,
    tolPx: GROUND_GLUE_TOL_M / metrics.meterByPx,
  });
  if (!runs.length) return { status: BRUSH_2D_STATUS.NO_GROUND };

  const create = createAnnotationFn;
  if (!create) return fallback("NO_CREATE_FN");
  const hostBaseMap =
    (baseMaps || []).find((bm) => bm.id === baseMap.id) ?? baseMap;

  return withUndoGroup(async () => {
    const annotationIds = [];
    for (const run of runs) {
      const fields = buildWallBandAnnotationFields(run, metrics);
      if (!fields) continue;
      const pointRefs = await insertOrReusePoints({
        projectedPoints: fields.points,
        baseMap: hostBaseMap,
        projectId,
        listingId,
      });
      const annotation = {
        id: nanoid(),
        projectId,
        listingId,
        annotationTemplateId: template.id,
        baseMapId: baseMap.id,
        ...(layerId ? { layerId } : {}),
        points: pointRefs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...buildFaceAnnotationFields({
          classifiedShape: "POLYLINE",
          classificationFields: {
            type: "POLYLINE",
            closeLine: fields.closeLine,
            offsetZ: fields.offsetZ,
            height: fields.height,
          },
          templateProps,
        }),
        ...extraFields,
      };
      const created = await create(annotation);
      if (created?.id) annotationIds.push(created.id);
    }
    return annotationIds.length
      ? { status: BRUSH_2D_STATUS.CREATED, annotationIds }
      : fallback("NO_BAND");
  });
}
