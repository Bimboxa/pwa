import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

/**
 * Hook that handles the COMPLETE_ANNOTATION commit logic.
 *
 * Three commit cases:
 * 1. POLYLINE + Enter (open path)       → new POLYLINE from drawn points
 * 2. POLYLINE + reconnect to same       → new POLYGON (drawn path + original segment)
 * 3. POLYGON  + reconnect to same       → modify polygon (replace shortest contour side)
 */
export default function useHandleCompleteAnnotation({ newEntity } = {}) {
  const dispatch = useDispatch();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  /**
   * Find annotations that contain a given point ID in their points array.
   */
  async function findAnnotationsWithPoint(pointId) {
    const allAnnotations = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    return allAnnotations.filter(
      (a) =>
        !a.deletedAt &&
        (a.type === "POLYLINE" || a.type === "POLYGON") &&
        a.points?.some((p) => p.id === pointId)
    );
  }

  // main

  /**
   * @param {Array} rawDrawnPoints - drawn points in local/pixel coords
   * @param {object} options
   * @param {string} options.completeAnnotationId - the annotation being extended
   * @param {string} options.startPointId - the starting vertex point ID
   * @param {string} [options.endPointId] - the ending vertex point ID (if reconnecting)
   */
  const handleCompleteAnnotationCommit = async (rawDrawnPoints, options) => {
    const { completeAnnotationId, startPointId, endPointId } = options;

    const imageSize =
      baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    if (!imageSize) {
      console.warn("[useHandleCompleteAnnotation] No image size available");
      return;
    }

    // Fetch the target annotation from DB
    const annotation = await db.annotations.get(completeAnnotationId);
    if (!annotation) {
      dispatch(
        setToaster({ message: "Annotation not found", isError: true })
      );
      return;
    }

    const annotationPoints = annotation.points ?? [];
    const isPolyline = annotation.type === "POLYLINE";
    const isPolygon = annotation.type === "POLYGON";

    // Convert drawn points to normalized (0-1) coords and save to DB
    const drawnPointRecords = rawDrawnPoints.map((pt) => ({
      id: pt.existingPointId || nanoid(),
      x: pt.x / imageSize.width,
      y: pt.y / imageSize.height,
      baseMapId,
      projectId,
      listingId,
    }));

    // Filter out points that already exist (snapped vertices)
    const newPointsToSave = drawnPointRecords.filter(
      (p) => !rawDrawnPoints.find((rp) => rp.existingPointId === p.id)
    );

    if (newPointsToSave.length > 0) {
      await db.points.bulkAdd(newPointsToSave);
    }

    const drawnPointRefs = drawnPointRecords.map((p) => ({ id: p.id }));

    // Insert PROJECTION/MIDPOINT snap points into the annotation's points array
    // so that startPointId/endPointId become actual vertices of the annotation.
    let updatedAnnotationPoints = [...annotationPoints];
    let effectiveStartPointId = startPointId;
    let effectiveEndPointId = endPointId;

    const firstDrawn = rawDrawnPoints[0];
    const lastDrawn = rawDrawnPoints[rawDrawnPoints.length - 1];

    // Insert start point if it was a snap on a segment (not an existing vertex)
    if (!startPointId && firstDrawn?.snapSegment) {
      const { segmentStartId, segmentEndId } = firstDrawn.snapSegment;
      const segStartIdx = updatedAnnotationPoints.findIndex(
        (p) => p.id === segmentStartId
      );
      if (segStartIdx !== -1) {
        const newPointRef = { id: drawnPointRecords[0].id };
        updatedAnnotationPoints.splice(segStartIdx + 1, 0, newPointRef);
        effectiveStartPointId = newPointRef.id;
      }
    }

    // Insert end point if it was a snap on a segment (not an existing vertex)
    if (!endPointId && lastDrawn?.snapSegment) {
      const { segmentStartId, segmentEndId } = lastDrawn.snapSegment;
      const segStartIdx = updatedAnnotationPoints.findIndex(
        (p) => p.id === segmentStartId
      );
      if (segStartIdx !== -1) {
        const newPointRef = { id: drawnPointRecords[drawnPointRecords.length - 1].id };
        updatedAnnotationPoints.splice(segStartIdx + 1, 0, newPointRef);
        effectiveEndPointId = newPointRef.id;
      }
    }

    // If we inserted snap points, update the annotation in DB first
    if (updatedAnnotationPoints.length !== annotationPoints.length) {
      annotation.points = updatedAnnotationPoints;
      await updateAnnotation({
        ...annotation,
        points: updatedAnnotationPoints,
      });
    }

    // Re-alias for the cases below
    const finalAnnotationPoints = updatedAnnotationPoints;

    // Case 1: POLYLINE + Enter (open path, no reconnection) → extend the polyline
    if (isPolyline && !effectiveEndPointId) {
      const startIdx = finalAnnotationPoints.findIndex(
        (p) => p.id === effectiveStartPointId
      );

      let newPoints;
      if (startIdx === 0) {
        // Start point is at the beginning → prepend drawn points (reversed)
        newPoints = [
          ...drawnPointRefs.slice(1).reverse(),
          ...finalAnnotationPoints,
        ];
      } else if (startIdx === finalAnnotationPoints.length - 1) {
        // Start point is at the end → append drawn points
        newPoints = [
          ...finalAnnotationPoints,
          ...drawnPointRefs.slice(1),
        ];
      } else {
        // Start point is in the middle → create a new polyline (can't extend)
        const entity = await createEntity(newEntity);
        const {
          id: _id,
          entityId: _eid,
          cuts: _cuts,
          ...hostProps
        } = annotation;
        await createAnnotation({
          ...hostProps,
          id: nanoid(),
          entityId: entity.id,
          type: "POLYLINE",
          points: [{ id: effectiveStartPointId }, ...drawnPointRefs.slice(1)],
          closeLine: false,
        });
        dispatch(
          setToaster({ message: "Polyline created", isError: false })
        );
        return;
      }

      await updateAnnotation({
        ...annotation,
        points: newPoints.map((p) => ({ id: p.id })),
      });
      dispatch(
        setToaster({ message: "Polyline extended", isError: false })
      );
      return;
    }

    // Case 2: POLYLINE + reconnect to same polyline
    if (isPolyline && effectiveEndPointId) {
      const startIdx = finalAnnotationPoints.findIndex(
        (p) => p.id === effectiveStartPointId
      );
      const endIdx = finalAnnotationPoints.findIndex((p) => p.id === effectiveEndPointId);
      if (startIdx === -1 || endIdx === -1) {
        dispatch(
          setToaster({ message: "Vertex not found", isError: true })
        );
        return;
      }

      // Extract the segment of the original polyline between start and end
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      const originalSegment = finalAnnotationPoints.slice(lo, hi + 1);

      // Build polygon: drawn path + original segment (reversed to close)
      let polygonPoints;
      if (startIdx <= endIdx) {
        polygonPoints = [
          ...drawnPointRefs,
          ...originalSegment
            .slice(0, -1)
            .reverse()
            .map((p) => ({ id: p.id })),
        ];
      } else {
        polygonPoints = [
          ...drawnPointRefs,
          ...originalSegment
            .slice(1)
            .map((p) => ({ id: p.id })),
        ];
      }

      const entity = await createEntity(newEntity);
      const {
        id: _id,
        entityId: _eid,
        cuts: _cuts,
        ...hostProps
      } = annotation;
      await createAnnotation({
        ...hostProps,
        id: nanoid(),
        entityId: entity.id,
        type: "POLYGON",
        points: polygonPoints,
        closeLine: undefined,
      });
      dispatch(
        setToaster({ message: "Polygon created", isError: false })
      );
      return;
    }

    // Case 3: POLYGON + reconnect to same polygon → split into 2 polygons
    if (isPolygon && effectiveEndPointId) {
      const startIdx = finalAnnotationPoints.findIndex(
        (p) => p.id === effectiveStartPointId
      );
      const endIdx = finalAnnotationPoints.findIndex((p) => p.id === effectiveEndPointId);
      if (startIdx === -1 || endIdx === -1) {
        dispatch(
          setToaster({ message: "Vertex not found", isError: true })
        );
        return;
      }

      const n = finalAnnotationPoints.length;

      // Two paths around the polygon between start and end
      // Path A: startIdx → ... → endIdx (forward)
      const pathALength = ((endIdx - startIdx + n) % n) || n;
      // Path B: endIdx → ... → startIdx (the other way)
      const pathBLength = n - pathALength;

      // Drawn inner points (excluding start & end which are shared with the polygon)
      const drawnInner = drawnPointRefs.slice(1, -1);

      // Build both polygon pieces
      let polygon1Points, polygon2Points;
      if (pathALength <= pathBLength) {
        // Path B (endIdx → ... → startIdx) + drawn inner → polygon 1
        const pathB = [];
        for (let i = 0; i <= pathBLength; i++) {
          pathB.push(finalAnnotationPoints[(endIdx + i) % n]);
        }
        polygon1Points = [
          ...pathB.map((p) => ({ id: p.id })),
          ...drawnInner,
        ];

        // Path A (startIdx → ... → endIdx) + drawn inner reversed → polygon 2
        const pathA = [];
        for (let i = 0; i <= pathALength; i++) {
          pathA.push(finalAnnotationPoints[(startIdx + i) % n]);
        }
        polygon2Points = [
          ...pathA.map((p) => ({ id: p.id })),
          ...[...drawnInner].reverse(),
        ];
      } else {
        // Path A (startIdx → ... → endIdx) + drawn inner reversed → polygon 1
        const pathA = [];
        for (let i = 0; i <= pathALength; i++) {
          pathA.push(finalAnnotationPoints[(startIdx + i) % n]);
        }
        polygon1Points = [
          ...pathA.map((p) => ({ id: p.id })),
          ...[...drawnInner].reverse(),
        ];

        // Path B (endIdx → ... → startIdx) + drawn inner → polygon 2
        const pathB = [];
        for (let i = 0; i <= pathBLength; i++) {
          pathB.push(finalAnnotationPoints[(endIdx + i) % n]);
        }
        polygon2Points = [
          ...pathB.map((p) => ({ id: p.id })),
          ...drawnInner,
        ];
      }

      // Update original annotation with polygon 1
      await updateAnnotation({
        ...annotation,
        points: polygon1Points,
      });

      // Create new entity + annotation for polygon 2
      const entity = await createEntity(newEntity);
      const {
        id: _id,
        entityId: _eid,
        cuts: _cuts,
        ...hostProps
      } = annotation;
      await createAnnotation({
        ...hostProps,
        id: nanoid(),
        entityId: entity.id,
        points: polygon2Points,
      });

      dispatch(
        setToaster({
          message: "Polygon split",
          isError: false,
        })
      );
      return;
    }

    // Fallback: polygon + open path (just create a new polyline)
    if (isPolygon && !effectiveEndPointId) {
      const entity = await createEntity(newEntity);
      const {
        id: _id,
        entityId: _eid,
        cuts: _cuts,
        ...hostProps
      } = annotation;
      const startRef = effectiveStartPointId ? [{ id: effectiveStartPointId }] : [];
      await createAnnotation({
        ...hostProps,
        id: nanoid(),
        entityId: entity.id,
        type: "POLYLINE",
        points: [...startRef, ...drawnPointRefs.slice(startRef.length ? 1 : 0)],
        closeLine: false,
      });
      dispatch(
        setToaster({ message: "Polyline created", isError: false })
      );
      return;
    }
  };

  return { handleCompleteAnnotationCommit, findAnnotationsWithPoint };
}
