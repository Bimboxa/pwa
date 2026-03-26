import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
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
    pointId: snap.id,
    annotationId: snap.annotationId || snap.previewAnnotationId,
    annotationType: snap.annotationType,
    segmentIndex: snap.previewSegmentIndex,
  };
}

export default function useHandleSplitPolylineClick({ newEntity } = {}) {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  /**
   * Handle a single click with snap data — split the polyline at that point.
   */
  const handleSplitPolylineClickPoint = async (rawSnap) => {
    const snap = normalizeSnap(rawSnap);
    if (!snap || !snap.annotationId) {
      dispatch(
        setToaster({ message: "No snap point detected", isError: true })
      );
      return { status: "no_snap" };
    }

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

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize) {
      dispatch(
        setToaster({ message: "Image size not available", isError: true })
      );
      return { status: "error" };
    }

    if (snap.type === "VERTEX") {
      const vertexIndex = annotation.points.findIndex(
        (p) => p.id === snap.pointId
      );
      if (vertexIndex === -1) {
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
        dispatch(
          setToaster({
            message: "Cannot split at endpoints",
            isError: true,
          })
        );
        return { status: "error" };
      }

      await updateAnnotation({
        ...annotation,
        points: result.piece1,
        closeLine: false,
      });

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
    } else {
      // PROJECTION: insert a new point at the projection position, then split there
      const newPointId = nanoid();
      const normalizedX = snap.x / imageSize.width;
      const normalizedY = snap.y / imageSize.height;

      await db.points.add({
        id: newPointId,
        x: normalizedX,
        y: normalizedY,
        baseMapId,
        projectId,
        listingId,
      });

      const insertAfter = snap.segmentIndex;
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
        dispatch(
          setToaster({
            message: "Cannot split at this point",
            isError: true,
          })
        );
        return { status: "error" };
      }

      await updateAnnotation({
        ...annotation,
        points: result.piece1,
        closeLine: false,
      });

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
    }

    dispatch(
      setToaster({
        message: "Polyline split successfully",
        isError: false,
      })
    );
    return { status: "split_done" };
  };

  return { handleSplitPolylineClickPoint };
}
