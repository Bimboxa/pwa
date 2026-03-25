import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useNewEntity from "Features/entities/hooks/useNewEntity";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Find a polyline (other than the source) that shares a pointId with `point`.
 * Two annotations are connected when they reference the same point by id.
 * Returns the matched annotation or null.
 */
async function findConnectedPolyline(
  point,
  sourceAnnotationId,
  baseMapId,
  visibleIds
) {
  const candidates = await db.annotations
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();

  const pointId = point.id;

  for (const ann of candidates) {
    if (ann.id === sourceAnnotationId) continue;
    if (visibleIds && !visibleIds.has(ann.id)) continue;
    if (!["POLYLINE", "STRIP"].includes(ann.type)) continue;
    if (!ann.points?.length) continue;

    for (const vertex of ann.points) {
      if (vertex.id === pointId) {
        return ann;
      }
    }
  }
  return null;
}

/**
 * Resolve a point reference { id } to { id, x, y } using the points table
 * and the image size. Coordinates are returned in pixels.
 */
async function resolvePointCoords(point, imageSize) {
  const dbPoint = await db.points.get(point.id);
  if (dbPoint) {
    return {
      ...point,
      x: dbPoint.x * imageSize.width,
      y: dbPoint.y * imageSize.height,
    };
  }
  // Fallback: point already has coordinates (normalized)
  if (point.x !== undefined && point.y !== undefined) {
    return {
      ...point,
      x: point.x * imageSize.width,
      y: point.y * imageSize.height,
    };
  }
  return null;
}

export default function useHandleTechnicalReturn({ annotations } = {}) {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const newEntity = useNewEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  const handleTechnicalReturn = async (annotationId, segmentIndex) => {
    const visibleIds = new Set(annotations?.map((a) => a.id));

    // 1. Fetch the clicked annotation
    const annotation = await db.annotations.get(annotationId);
    if (!annotation) {
      dispatch(setToaster({ message: "Annotation not found", isError: true }));
      return;
    }

    if (!["POLYLINE", "STRIP"].includes(annotation.type)) {
      dispatch(
        setToaster({
          message: "Technical return only works on polylines and strips",
          isError: true,
        })
      );
      return;
    }

    const points = annotation.points; // [{ id, type? }, ...]
    if (!points || segmentIndex < 0 || segmentIndex >= points.length - 1) {
      return;
    }

    // 2. Get segment endpoint references (pointId-based)
    const pRefA = points[segmentIndex];
    const pRefB = points[segmentIndex + 1];

    // 3. Check if either endpoint shares a pointId with another polyline
    const connectedAtA = await findConnectedPolyline(
      pRefA,
      annotationId,
      annotation.baseMapId,
      visibleIds
    );
    const connectedAtB = await findConnectedPolyline(
      pRefB,
      annotationId,
      annotation.baseMapId,
      visibleIds
    );

    if (!connectedAtA && !connectedAtB) {
      dispatch(
        setToaster({
          message: "No connected polyline found on this segment",
          isError: true,
        })
      );
      return;
    }

    // 4. Determine which end is the contact point.
    // Prefer the endpoint connected to an annotation with a different template.
    let contactIsA;
    if (connectedAtA && connectedAtB) {
      const diffA =
        connectedAtA.annotationTemplateId !== annotation.annotationTemplateId;
      const diffB =
        connectedAtB.annotationTemplateId !== annotation.annotationTemplateId;
      contactIsA = diffA || !diffB;
    } else {
      contactIsA = Boolean(connectedAtA);
    }
    const contactRef = contactIsA ? pRefA : pRefB;
    const otherRef = contactIsA ? pRefB : pRefA;
    const connectedAnnotation = contactIsA ? connectedAtA : connectedAtB;

    // 5. Resolve point coordinates from the points table
    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize) {
      dispatch(
        setToaster({ message: "Image size not available", isError: true })
      );
      return;
    }

    const contactCoords = await resolvePointCoords(contactRef, imageSize);
    const otherCoords = await resolvePointCoords(otherRef, imageSize);
    if (!contactCoords || !otherCoords) {
      dispatch(
        setToaster({ message: "Could not resolve point coordinates", isError: true })
      );
      return;
    }

    // 6. Compute 1m in pixels
    const meterByPx = baseMap?.getMeterByPx?.();
    if (!meterByPx) {
      dispatch(
        setToaster({ message: "Base map scale not available", isError: true })
      );
      return;
    }
    const oneMeterPx = 1 / meterByPx;

    // 7. Compute the split point at 1m from the contact point
    const segmentLength = dist(contactCoords, otherCoords);
    if (segmentLength <= oneMeterPx) {
      dispatch(
        setToaster({
          message: "Segment shorter than 1m — no technical return created",
          isError: true,
        })
      );
      return;
    }

    // Direction from contact to other
    const dx = otherCoords.x - contactCoords.x;
    const dy = otherCoords.y - contactCoords.y;
    const ratio = oneMeterPx / segmentLength;

    // Split point in pixels
    const splitX = contactCoords.x + dx * ratio;
    const splitY = contactCoords.y + dy * ratio;

    // Store split point in the DB as normalized coordinates
    const splitPointId = nanoid();
    await db.points.add({
      id: splitPointId,
      x: splitX / imageSize.width,
      y: splitY / imageSize.height,
      projectId: annotation.projectId,
      listingId: annotation.listingId,
      baseMapId: annotation.baseMapId,
    });

    const splitPointRef = { id: splitPointId, type: "square" };

    // 8. Build new point arrays using point references
    // returnPoints: the 1m sub-segment (contactPoint → splitPoint)
    const returnPoints = [contactRef, splitPointRef];

    // Replace the contact endpoint in the original annotation with the split point
    const newPoints = [...points];
    if (contactIsA) {
      newPoints[segmentIndex] = splitPointRef;
    } else {
      newPoints[segmentIndex + 1] = splitPointRef;
    }

    // 9. Update the original annotation (shortened segment)
    await updateAnnotation({
      ...annotation,
      points: newPoints,
    });

    // 10. Create a new annotation for the 1m return segment
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
      points: returnPoints,
      closeLine: false,
      annotationTemplateId: connectedAnnotation.annotationTemplateId,
    });

    dispatch(
      setToaster({
        message: "1m technical return created",
        isError: false,
      })
    );
  };

  return handleTechnicalReturn;
}
