import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

import fitArcSplineThroughPolyline from "Features/geometry/utils/fitArcSplineThroughPolyline";

// In-place "arc-ify" of a single POLYLINE: segments the line into straight
// runs + circular arcs (square → circle → square triplets) and rewrites the
// annotation's points. The annotation identity (entity, label, layer,
// template) is preserved — only `points` change.
export default function useArcifyAnnotation() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async (annotation) => {
    if (
      annotation?.type !== "POLYLINE" ||
      !Array.isArray(annotation.points) ||
      annotation.points.length < 3
    ) {
      return { changed: false };
    }

    // Image size — convert pixel coords back to normalized [0..1] before
    // storage (match useAnnotationsV2: method first, then prop).
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    const width = imageSize?.width || 1;
    const height = imageSize?.height || 1;

    // annotation.points are already resolved to pixel space here.
    const pxPoints = annotation.points
      .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
      .map((p) => ({ x: p.x, y: p.y }));

    const fit = fitArcSplineThroughPolyline(pxPoints);
    if (!fit || !fit.chainPoints?.length) {
      console.warn("[arcify] could not fit arcs (too few / collinear points)");
      return { changed: false };
    }

    // Mint fresh point ids; persist normalized [0..1] coords in db.points.
    // The annotation's `points` field only stores [{id, type}] references.
    const records = [];
    const refs = fit.chainPoints.map((p) => {
      const id = nanoid();
      records.push({
        id,
        x: p.x / width,
        y: p.y / height,
        projectId: annotation.projectId ?? projectId,
        baseMapId: annotation.baseMapId,
        listingId: annotation.listingId,
      });
      return { id, type: p.type };
    });

    await db.transaction("rw", db.annotations, db.points, async () => {
      await db.points.bulkAdd(records);
      await db.annotations.update(annotation.id, { points: refs });
    });

    dispatch(triggerAnnotationsUpdate());

    return { changed: true, count: refs.length };
  };
}
