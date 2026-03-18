import { useRef } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useNewEntity from "Features/entities/hooks/useNewEntity";
import splitPolylineBetweenPoints from "Features/mapEditor/utils/splitPolylineBetweenPoints";
import splitPolylineAtVertex from "Features/mapEditor/utils/splitPolylineAtVertex";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

/**
 * Normalize a snap result into a consistent format with annotationId.
 */
function normalizeSnap(snap) {
  if (!snap) return null;
  return {
    type: snap.type,
    x: snap.x,
    y: snap.y,
    pointId: snap.id, // VERTEX: the point id
    annotationId: snap.annotationId || snap.previewAnnotationId,
    annotationType: snap.annotationType,
    segmentIndex: snap.previewSegmentIndex,
    segmentStartId: snap.segmentStartId,
    segmentEndId: snap.segmentEndId,
  };
}

export default function useHandleSplitPolyline() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const createEntity = useCreateEntity();
  const newEntity = useNewEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  const firstClickRef = useRef(null);

  /**
   * Convert a normalized snap to the info format expected by splitPolylineBetweenPoints.
   */
  function snapToSplitInfo(snap, annotation, imageSize) {
    if (snap.type === "VERTEX") {
      const vertexIndex = annotation.points.findIndex(
        (p) => p.id === snap.pointId
      );
      if (vertexIndex === -1) return null;
      return { type: "VERTEX", vertexIndex };
    }

    // PROJECTION: convert pixel coords to normalized for DB storage
    return {
      type: "PROJECTION",
      segmentIndex: snap.segmentIndex,
      x: snap.x / imageSize.width,
      y: snap.y / imageSize.height,
    };
  }

  /**
   * Handle a click with snap data. Returns status for InteractionLayer to manage drawingPoints.
   */
  const handleSplitPolylineClick = async (rawSnap) => {
    const snap = normalizeSnap(rawSnap);
    if (!snap || !snap.annotationId) {
      dispatch(
        setToaster({ message: "No snap point detected", isError: true })
      );
      return { status: "no_snap" };
    }

    // First click: store snap data
    if (!firstClickRef.current) {
      const annotation = await db.annotations.get(snap.annotationId);
      if (!annotation) {
        dispatch(
          setToaster({ message: "Annotation not found", isError: true })
        );
        return { status: "error" };
      }
      if (!["POLYLINE", "STRIP"].includes(annotation.type)) {
        dispatch(
          setToaster({
            message: "This tool only works on polylines and strips",
            isError: true,
          })
        );
        return { status: "error" };
      }
      firstClickRef.current = snap;
      return { status: "first_point_set" };
    }

    // Second click: validate and perform split
    const first = firstClickRef.current;
    if (snap.annotationId !== first.annotationId) {
      dispatch(
        setToaster({
          message: "Both points must be on the same polyline",
          isError: true,
        })
      );
      return { status: "error" };
    }

    const annotation = await db.annotations.get(snap.annotationId);
    if (!annotation) {
      firstClickRef.current = null;
      dispatch(
        setToaster({ message: "Annotation not found", isError: true })
      );
      return { status: "error" };
    }

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize) {
      dispatch(
        setToaster({ message: "Image size not available", isError: true })
      );
      return { status: "error" };
    }

    const info1 = snapToSplitInfo(first, annotation, imageSize);
    const info2 = snapToSplitInfo(snap, annotation, imageSize);
    if (!info1 || !info2) {
      firstClickRef.current = null;
      dispatch(
        setToaster({
          message: "Could not resolve snap points",
          isError: true,
        })
      );
      return { status: "error" };
    }

    const result = splitPolylineBetweenPoints(
      annotation.points,
      info1,
      info2,
      annotation.closeLine
    );

    if (!result) {
      firstClickRef.current = null;
      dispatch(
        setToaster({ message: "Cannot split at these points", isError: true })
      );
      return { status: "error" };
    }

    // Save new projection points to DB
    if (result.newPoints.length > 0) {
      await db.points.bulkAdd(
        result.newPoints.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          baseMapId,
          projectId,
          listingId,
        }))
      );
    }

    // Update original annotation with piece1
    await updateAnnotation({
      ...annotation,
      points: result.piece1,
      closeLine: false,
    });

    // Create new annotation for piece2 if it exists
    if (result.piece2) {
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
        points: result.piece2,
        closeLine: false,
      });
    }

    firstClickRef.current = null;
    dispatch(
      setToaster({ message: "Polyline split successfully", isError: false })
    );
    return { status: "split_done" };
  };

  /**
   * Handle Enter key: split at the single first point.
   */
  const handleSplitPolylineEnter = async () => {
    const first = firstClickRef.current;
    if (!first) return { status: "no_first_point" };

    const annotation = await db.annotations.get(first.annotationId);
    if (!annotation) {
      firstClickRef.current = null;
      dispatch(
        setToaster({ message: "Annotation not found", isError: true })
      );
      return { status: "error" };
    }

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize) {
      dispatch(
        setToaster({ message: "Image size not available", isError: true })
      );
      return { status: "error" };
    }

    if (first.type === "VERTEX") {
      // Reuse splitPolylineAtVertex logic
      const vertexIndex = annotation.points.findIndex(
        (p) => p.id === first.pointId
      );
      if (vertexIndex === -1) {
        firstClickRef.current = null;
        dispatch(
          setToaster({
            message: "Vertex not found in annotation",
            isError: true,
          })
        );
        return { status: "error" };
      }

      const result = splitPolylineAtVertex(
        annotation.points,
        vertexIndex,
        annotation.closeLine
      );
      if (!result) {
        firstClickRef.current = null;
        dispatch(
          setToaster({
            message: "Cannot split at this vertex",
            isError: true,
          })
        );
        return { status: "error" };
      }

      if (result.piece2) {
        await updateAnnotation({
          ...annotation,
          points: result.piece1,
          closeLine: false,
        });
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
          points: result.piece2,
          closeLine: false,
        });
      } else {
        await updateAnnotation({
          ...annotation,
          points: result.piece1,
          closeLine: false,
        });
      }
    } else {
      // PROJECTION: insert a new point at the projection position, then split there
      const newPointId = nanoid();
      const normalizedX = first.x / imageSize.width;
      const normalizedY = first.y / imageSize.height;

      await db.points.add({
        id: newPointId,
        x: normalizedX,
        y: normalizedY,
        baseMapId,
        projectId,
        listingId,
      });

      const insertAfter = first.segmentIndex;
      const newPoints = [
        ...annotation.points.slice(0, insertAfter + 1),
        { id: newPointId },
        ...annotation.points.slice(insertAfter + 1),
      ];

      const vertexIndex = insertAfter + 1;
      const result = splitPolylineAtVertex(
        newPoints,
        vertexIndex,
        annotation.closeLine
      );
      if (!result) {
        firstClickRef.current = null;
        dispatch(
          setToaster({
            message: "Cannot split at this point",
            isError: true,
          })
        );
        return { status: "error" };
      }

      if (result.piece2) {
        await updateAnnotation({
          ...annotation,
          points: result.piece1,
          closeLine: false,
        });
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
          points: result.piece2,
          closeLine: false,
        });
      } else {
        await updateAnnotation({
          ...annotation,
          points: result.piece1,
          closeLine: false,
        });
      }
    }

    firstClickRef.current = null;
    dispatch(
      setToaster({
        message: "Polyline split successfully",
        isError: false,
      })
    );
    return { status: "split_done" };
  };

  const resetSplitPolyline = () => {
    firstClickRef.current = null;
  };

  return {
    handleSplitPolylineClick,
    handleSplitPolylineEnter,
    resetSplitPolyline,
  };
}
