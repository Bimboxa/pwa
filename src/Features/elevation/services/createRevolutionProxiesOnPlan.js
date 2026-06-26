import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";

// Reads a baseMap record's reference image size without loading the image file.
// Mirrors BaseMap.getImageSize (version refWidth/refHeight else legacy image).
function getRecordImageSize(record) {
  if (!record) return null;
  if (record.versions?.length && record.refWidth && record.refHeight) {
    return { width: record.refWidth, height: record.refHeight };
  }
  return record.image?.imageSize ?? null;
}

// 4 inscribed-square vertices on a circle with alternating square/circle types,
// so the canonical arc renderer (S–C–S pattern) draws a full circle. Same shape
// produced by getPolylinePointsFromCircle.
function circleRingPoints(cx, cy, r) {
  return [
    { x: cx + r, y: cy, type: "square" },
    { x: cx, y: cy + r, type: "circle" },
    { x: cx - r, y: cy, type: "square" },
    { x: cx, y: cy - r, type: "circle" },
  ];
}

/**
 * Creates the plan-view "donut" proxy polygons for a revolution axis.
 *
 * For each arc linked to `axisId` (shape3D.key === "REVOLUTION",
 * shape3D.axisAnnotationId === axisId) we project the revolved surface onto the
 * plan as an annulus centred on `centerPx`:
 *   - outer radius = max horizontal distance of the arc to the axis
 *   - inner radius = min horizontal distance (a full disk when the arc touches
 *     the axis).
 * Radii are taken in metres on the arc's (vertical) baseMap, then converted to
 * pixels on the plan baseMap.
 *
 * Each proxy is a POLYGON tagged `isProxy`, linked to its source arc via
 * `proxySourceAnnotationId` + `revolutionAxisId`, and reuses the source arc's
 * `annotationTemplateId` / `entityId`.
 *
 * Idempotent: an arc that already has a proxy for this axis is skipped.
 *
 * @returns the created proxy annotations.
 */
export default async function createRevolutionProxiesOnPlan({
  axisId,
  centerPx, // { x, y } pixel centre on the plan baseMap (commit click)
  planBaseMap, // BaseMap instance (the plan / horizontal baseMap)
  projectId,
  listingId,
  createAnnotation, // from useCreateAnnotation
}) {
  if (!axisId || !centerPx || !planBaseMap || !createAnnotation) return [];

  const axis = await db.annotations.get(axisId);
  if (!axis || axis.deletedAt) return [];

  const planImageSize = planBaseMap.getImageSize?.();
  const planMeterByPx = planBaseMap.getMeterByPx?.();
  if (!planImageSize || !planMeterByPx) return [];

  const projectAnnotations = (
    await db.annotations.where("projectId").equals(projectId).toArray()
  ).filter((a) => !a.deletedAt);

  const linkedArcs = projectAnnotations.filter(
    (a) =>
      getShape3DKey(a.shape3D) === "REVOLUTION" &&
      a.shape3D?.axisAnnotationId === axisId
  );
  if (linkedArcs.length === 0) return [];

  const { width: planW, height: planH } = planImageSize;
  const created = [];

  for (const arc of linkedArcs) {
    // Idempotency — one proxy per (arc, axis).
    const alreadyExists = projectAnnotations.some(
      (a) =>
        a.isProxy &&
        a.proxySourceAnnotationId === arc.id &&
        a.revolutionAxisId === axisId
    );
    if (alreadyExists) continue;

    const arcBaseMapRecord = await db.baseMaps.get(arc.baseMapId);
    const arcImageSize = getRecordImageSize(arcBaseMapRecord);
    const arcMeterByPx = arcBaseMapRecord?.meterByPx;
    if (!arcImageSize || !arcMeterByPx) continue;

    // Resolve arc + axis points to pixels on the arc's (vertical) baseMap.
    const pointIds = new Set();
    (arc.points ?? []).forEach((p) => p?.id && pointIds.add(p.id));
    (axis.points ?? []).forEach((p) => p?.id && pointIds.add(p.id));
    const ptArr = await db.points.bulkGet([...pointIds]);
    const pointsIndex = {};
    for (const p of ptArr) if (p) pointsIndex[p.id] = p;

    const arcPx = resolvePoints({
      points: arc.points,
      pointsIndex,
      imageSize: arcImageSize,
    });
    const axisPx = resolvePoints({
      points: axis.points,
      pointsIndex,
      imageSize: arcImageSize,
    });
    if (!arcPx?.length || !axisPx || axisPx.length < 2) continue;

    // Radius = horizontal distance to the axis line (same model as
    // buildRevolutionMesh / computeRevolutionSurface).
    const axisX = axisPx.reduce((s, p) => s + p.x, 0) / axisPx.length;
    const radiiPx = arcPx.map((p) => Math.abs(p.x - axisX));
    const rMinM = Math.min(...radiiPx) * arcMeterByPx;
    const rMaxM = Math.max(...radiiPx) * arcMeterByPx;
    if (!(rMaxM > 0)) continue;

    // Back to plan pixels.
    const rOuter = rMaxM / planMeterByPx;
    const rInner = rMinM / planMeterByPx;

    // Treat a near-zero inner radius as a full disk (no hole).
    const hasHole = rInner > Math.max(1, rOuter * 0.02);

    const pointsToSave = [];
    const buildRefs = (ring) =>
      ring.map((pt) => {
        const id = nanoid();
        pointsToSave.push({
          id,
          x: pt.x / planW,
          y: pt.y / planH,
          baseMapId: planBaseMap.id,
          projectId,
          listingId,
        });
        return { id, type: pt.type };
      });

    const outerRefs = buildRefs(
      circleRingPoints(centerPx.x, centerPx.y, rOuter)
    );
    const cuts = hasHole
      ? [
          {
            points: buildRefs(circleRingPoints(centerPx.x, centerPx.y, rInner)),
          },
        ]
      : [];

    if (pointsToSave.length > 0) await db.points.bulkAdd(pointsToSave);

    const proxy = {
      id: nanoid(),
      type: "POLYGON",
      baseMapId: planBaseMap.id,
      projectId,
      listingId,
      annotationTemplateId: arc.annotationTemplateId,
      points: outerRefs,
      cuts,
      closeLine: true,
      isProxy: true,
      proxySourceAnnotationId: arc.id,
      revolutionAxisId: axisId,
    };

    const res = await createAnnotation(proxy, { entityId: arc.entityId });
    if (res) created.push(res);
  }

  return created;
}
