import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";

import getCenteredBandFromGuideLine from "Features/geometry/utils/getCenteredBandFromGuideLine";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import db from "App/db/db";

// Arc sampling resolution — only used to measure the guideLine's true (curved)
// length for the slope, NOT to build the band (which keeps the arc control
// points). Mirrors getGuideLinesRampOffsets so the slope stays consistent.
const ARC_SAMPLES = 16;

// Commits a "Rampe" drawing. The input is the drawn median line in pixel
// (resolved) space — same units as annotation.points after useAnnotationsV2.
//
// From the median line + the transient toolbar params (rampWidthM, rampDeltaHM)
// we build:
//   - a POLYGON whose geometry is a band of width `rampWidthM` CENTERED on the
//     median line — its control points are the guideLine control points pushed
//     ±widthPx/2 perpendicular, keeping each point's type so arcs stay arcs
//     (no dense discretization).
//   - a guideLine equal to the median line, carrying slopePct derived from the
//     vertical delta over the median length:
//       slopePct = (deltaH_m / (L2D_px * meterByPx)) * 100
//
// showSlope is set on the annotation so the slope arrow/% shows in 2D and the
// 3D ramp applies (the height computation reads guideLines regardless).
export default function useHandleCommitRamp({ newEntity } = {}) {
  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const openedPanel = useSelector((s) => s.listings.openedPanel);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const rampWidthM = useSelector((s) => s.mapEditor.rampWidthM);
  const rampDeltaHM = useSelector((s) => s.mapEditor.rampDeltaHM);

  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();

  // helpers

  const isBaseMapAnnotation = openedPanel === "BASE_MAP_DETAIL";

  return async (pixelPts) => {
    if (!Array.isArray(pixelPts) || pixelPts.length < 2) return;

    const { width, height } = baseMap?.getImageSize?.() ?? {};
    const meterByPx = baseMap?.getMeterByPx?.();
    if (!width || !height || !meterByPx) return;

    const widthM = Number(rampWidthM) || 0;
    const deltaHM = Number(rampDeltaHM) || 0;
    const widthPx = widthM / meterByPx;
    if (!(widthPx > 0)) return;

    // 1. Centered band ring (pixel space): offset the guideLine CONTROL points
    // ±widthPx/2 perpendicular, keeping each point's type. A square→circle→
    // square arc on the median is reproduced as an arc on both band edges, so
    // the polygon stays at 2·N points instead of densely sampling the arcs.
    const bandRing = getCenteredBandFromGuideLine(pixelPts, widthPx);
    if (!Array.isArray(bandRing) || bandRing.length < 3) return;

    // 2. Slope from delta H over the median's true (arc-expanded) 2D length,
    // matching getGuideLinesRampOffsets (which expands the guideLine arcs).
    const expanded = expandArcsInPath(pixelPts, ARC_SAMPLES, false);
    let L2Dpx = 0;
    for (let i = 0; i < expanded.length - 1; i++) {
      L2Dpx += Math.hypot(
        expanded[i + 1].x - expanded[i].x,
        expanded[i + 1].y - expanded[i].y
      );
    }
    const slopePct =
      L2Dpx > 1e-6 && deltaHM ? (deltaHM / (L2Dpx * meterByPx)) * 100 : 0;

    // 3. Entity (skip for baseMap annotations, which live outside the tree).
    let entityId = newAnnotation?.entityId;
    if (!entityId && !isBaseMapAnnotation) {
      const entity = await createEntity(newEntity);
      entityId = entity?.id;
    }

    // 4. Persist band + median points to db.points (normalized [0..1]).
    const bandPoints = bandRing.map((p) => ({
      id: nanoid(),
      x: p.x / width,
      y: p.y / height,
      baseMapId,
      projectId,
      listingId,
    }));
    const medianPoints = pixelPts.map((p) => ({
      id: nanoid(),
      x: p.x / width,
      y: p.y / height,
      baseMapId,
      projectId,
      listingId,
    }));

    // 5. Find/create the annotationTemplate from newAnnotation (mirrors
    // useHandleCommitDrawing).
    let annotationTemplateId;
    if (newAnnotation && !isBaseMapAnnotation) {
      const existingTemplates = await db.annotationTemplates
        .where("listingId")
        .equals(listingId)
        .toArray();
      const existing = existingTemplates.find(
        (t) => t.id === newAnnotation.annotationTemplateId
      );
      if (existing) {
        annotationTemplateId = existing.id;
      } else {
        annotationTemplateId = nanoid();
        await db.annotationTemplates.add({
          id: annotationTemplateId,
          projectId,
          listingId,
          ...newAnnotation,
        });
      }
    }

    // 6. Build the annotation (band points + median as a guideLine).
    const _newAnnotation = {
      ...newAnnotation,
      id: nanoid(),
      type: "POLYGON",
      annotationTemplateId,
      entityId,
      baseMapId,
      projectId,
      listingId,
      ...(activeLayerId && !isBaseMapAnnotation ? { layerId: activeLayerId } : {}),
      // Keep the band points' type so circle control points render as arcs.
      points: bandPoints.map((p, i) => {
        const ref = { id: p.id };
        if (bandRing[i]?.type === "circle") ref.type = "circle";
        return ref;
      }),
      guideLines: [
        {
          // Keep the drawn per-point type (square/circle) so a "T" arc renders
          // on the guideLine and its slope axis follows the curve.
          points: medianPoints.map((p, i) => ({
            pointId: p.id,
            type: pixelPts[i]?.type === "circle" ? "circle" : "square",
          })),
          slopePct,
        },
      ],
      showSlope: true,
    };
    if (isBaseMapAnnotation) _newAnnotation.isBaseMapAnnotation = true;

    // 7. Write points + annotation.
    await db.points.bulkAdd([...bandPoints, ...medianPoints]);
    await createAnnotation(_newAnnotation);
  };
}
