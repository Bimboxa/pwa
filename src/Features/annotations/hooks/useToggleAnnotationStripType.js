import { useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateAnnotation from "./useUpdateAnnotation";

import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";

/**
 * Cycles an annotation through POLYLINE -> STRIP(side A) -> STRIP(side B) -> POLYLINE
 * while keeping the thick band visually fixed.
 *
 * A STRIP stores one EDGE of the band (the band extends by the full strokeWidth in
 * the perpendicular direction). A POLYLINE is a stroke centered on its points. To
 * keep the band at [C - W/2, C + W/2] across states, the points are parallel-offset:
 *   - POLYLINE(C) -> STRIP side A: edge = offset(C, -W/2), orientation +1
 *   - STRIP side A -> STRIP side B: edge = offset(edge, +W),  orientation -1
 *   - STRIP side B -> POLYLINE:    center = offset(edge, -W/2)
 *
 * Open polylines only (caller hides the action when closeLine is true).
 */
export default function useToggleAnnotationStripType() {
  const baseMap = useMainBaseMap();
  const updateAnnotation = useUpdateAnnotation();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async (annotation) => {
    if (!annotation?.id) return;

    const { type, points = [], closeLine } = annotation;
    if (!["POLYLINE", "STRIP"].includes(type)) return;
    if (closeLine) return; // open polylines only
    if (points.length < 2) return;

    const meterByPx = baseMap?.meterByPx ?? baseMap?.getMeterByPx?.();
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) return;

    // Band width in pixels (matches getStripePolygons unit conversion).
    const strokeWidth = annotation.strokeWidth ?? 2;
    const strokeWidthUnit = annotation.strokeWidthUnit ?? "PX";
    const Wpx =
      strokeWidthUnit === "CM" && meterByPx > 0
        ? (strokeWidth * 0.01) / meterByPx
        : strokeWidth;

    // annotation.points are already resolved to pixel space.
    const pts = points.map((p) => ({ x: p.x, y: p.y }));
    const orientation = annotation.stripOrientation ?? 1;

    let newPixelPoints;
    let fields;

    if (type === "POLYLINE") {
      // -> STRIP side A
      newPixelPoints = offsetPolyline(pts, -Wpx / 2);
      fields = { type: "STRIP", stripOrientation: 1 };
    } else if (orientation >= 0) {
      // STRIP side A -> STRIP side B
      newPixelPoints = offsetPolyline(pts, Wpx);
      fields = { type: "STRIP", stripOrientation: -1 };
    } else {
      // STRIP side B -> POLYLINE
      newPixelPoints = offsetPolyline(pts, -Wpx / 2);
      fields = {
        type: "POLYLINE",
        stripOrientation: undefined,
        cuts: undefined,
        hiddenSegmentsIdx: undefined,
      };
    }

    if (!newPixelPoints || newPixelPoints.length < 2) return;

    // New normalized point records (fresh ids — never mutate shared points).
    const newRecords = newPixelPoints.map((p) => ({
      id: nanoid(),
      x: p.x / imageSize.width,
      y: p.y / imageSize.height,
      projectId,
      baseMapId: annotation.baseMapId,
      listingId: annotation.listingId,
    }));
    const refs = newRecords.map((r) => ({ id: r.id }));

    await db.transaction("rw", db.annotations, db.points, async () => {
      await db.points.bulkAdd(newRecords);
      await updateAnnotation({ id: annotation.id, ...fields, points: refs });
    });
  };
}
