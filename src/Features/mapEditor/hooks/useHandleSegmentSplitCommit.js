import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

export default function useHandleSegmentSplitCommit() {
  // data

  const dispatch = useDispatch();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const newEntity = useNewEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  /**
   * Handle segment split for "retour technique".
   *
   * @param {object} params
   * @param {string} params.annotationId - The clicked annotation ID
   * @param {string} params.segmentStartId - Start point ID of the clicked segment
   * @param {string} params.segmentEndId - End point ID of the clicked segment
   * @param {Array} params.annotations - All annotations with resolved pixel coordinates
   */
  const handleSegmentSplitCommit = async ({
    annotationId,
    segmentStartId,
    segmentEndId,
    annotations,
  }) => {
    const imageSize = baseMap?.getImageSize?.();
    const meterByPx = baseMap?.getMeterByPx?.();
    if (!imageSize || !meterByPx) {
      dispatch(
        setToaster({ message: "No scale defined on this base map", isError: true })
      );
      return;
    }

    // 1. Find the clicked annotation (with resolved pixel points)
    const clickedAnnotation = annotations.find((a) => a.id === annotationId);
    if (!clickedAnnotation || clickedAnnotation.type !== "POLYLINE") {
      dispatch(
        setToaster({
          message: "Select a polyline segment",
          isError: true,
        })
      );
      return;
    }

    // 2. Find the segment endpoints in the clicked annotation
    const points = clickedAnnotation.points;
    let segIdx = -1;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (
        (a.id === segmentStartId && b.id === segmentEndId) ||
        (a.id === segmentEndId && b.id === segmentStartId)
      ) {
        segIdx = i;
        break;
      }
    }
    // Also check closing segment for closed polylines
    if (segIdx === -1 && clickedAnnotation.closeLine && points.length >= 3) {
      const a = points[points.length - 1];
      const b = points[0];
      if (
        (a.id === segmentStartId && b.id === segmentEndId) ||
        (a.id === segmentEndId && b.id === segmentStartId)
      ) {
        segIdx = points.length - 1;
      }
    }

    if (segIdx === -1) {
      dispatch(
        setToaster({ message: "Segment not found", isError: true })
      );
      return;
    }

    const ptA = segIdx < points.length ? points[segIdx] : points[points.length - 1];
    const ptB = segIdx + 1 < points.length ? points[segIdx + 1] : points[0];

    // 3. Find if either endpoint is shared with another POLYLINE annotation
    const otherAnnotations = annotations.filter(
      (a) =>
        a.id !== annotationId &&
        a.type === "POLYLINE" &&
        a.points?.length >= 2
    );

    let contactPointId = null; // The shared endpoint
    let connectedAnnotation = null;

    for (const other of otherAnnotations) {
      const otherPointIds = other.points.map((p) => p.id);
      if (otherPointIds.includes(ptA.id)) {
        contactPointId = ptA.id;
        connectedAnnotation = other;
        break;
      }
      if (otherPointIds.includes(ptB.id)) {
        contactPointId = ptB.id;
        connectedAnnotation = other;
        break;
      }
    }

    if (!contactPointId || !connectedAnnotation) {
      dispatch(
        setToaster({
          message: "No connected polyline found on this segment",
          isError: true,
        })
      );
      return;
    }

    // 4. Compute the split point at 1m from the contact point
    const contactPoint =
      contactPointId === ptA.id ? ptA : ptB;
    const otherPoint =
      contactPointId === ptA.id ? ptB : ptA;

    // Segment length in pixels
    const dx = otherPoint.x - contactPoint.x;
    const dy = otherPoint.y - contactPoint.y;
    const segLengthPx = Math.sqrt(dx * dx + dy * dy);
    const segLengthM = segLengthPx * meterByPx;

    if (segLengthM <= 1.0) {
      dispatch(
        setToaster({
          message: "Segment is shorter than 1m, cannot split",
          isError: true,
        })
      );
      return;
    }

    // Split at 1m from the contact point
    const splitRatio = (1.0 / meterByPx) / segLengthPx; // ratio along segment
    const splitX = contactPoint.x + dx * splitRatio;
    const splitY = contactPoint.y + dy * splitRatio;

    // Convert to relative coordinates (0-1)
    const splitXRel = splitX / imageSize.width;
    const splitYRel = splitY / imageSize.height;

    // 5. Create the new split point in DB
    const splitPointId = nanoid();
    await db.points.add({
      id: splitPointId,
      x: splitXRel,
      y: splitYRel,
      baseMapId,
      projectId,
      listingId,
    });

    // 6. Get the raw annotation from DB (with point refs only)
    const rawAnnotation = await db.annotations.get(annotationId);
    if (!rawAnnotation) return;

    // Find the segment index in the raw points
    const rawPoints = rawAnnotation.points;
    let rawSegIdx = -1;
    for (let i = 0; i < rawPoints.length - 1; i++) {
      const a = rawPoints[i];
      const b = rawPoints[i + 1];
      if (
        (a.id === segmentStartId && b.id === segmentEndId) ||
        (a.id === segmentEndId && b.id === segmentStartId)
      ) {
        rawSegIdx = i;
        break;
      }
    }
    if (rawSegIdx === -1 && rawAnnotation.closeLine && rawPoints.length >= 3) {
      const a = rawPoints[rawPoints.length - 1];
      const b = rawPoints[0];
      if (
        (a.id === segmentStartId && b.id === segmentEndId) ||
        (a.id === segmentEndId && b.id === segmentStartId)
      ) {
        rawSegIdx = rawPoints.length - 1;
      }
    }

    if (rawSegIdx === -1) return;

    // Determine which raw point is the contact point
    const rawPtA = rawPoints[rawSegIdx];
    const rawPtB =
      rawSegIdx + 1 < rawPoints.length ? rawPoints[rawSegIdx + 1] : rawPoints[0];
    const contactIsA = rawPtA.id === contactPointId;

    const splitPointRef = { id: splitPointId, type: "square" };

    // 7. Update the original annotation: replace segment with two sub-segments
    // The 1m portion (contact → split) will become a new annotation
    // The remaining portion (split → other) stays in the original annotation
    const newRawPoints = [...rawPoints];
    if (contactIsA) {
      // Segment is [rawSegIdx] → [rawSegIdx+1], contact at rawSegIdx
      // Insert split point after contact point: [contact, splitPoint, otherPoint]
      newRawPoints.splice(rawSegIdx + 1, 0, splitPointRef);
    } else {
      // Contact is at rawSegIdx+1 (or index 0 for closing segment)
      // Insert split point before contact point: [otherPoint, splitPoint, contact]
      newRawPoints.splice(rawSegIdx + 1, 0, splitPointRef);
    }

    await updateAnnotation({
      ...rawAnnotation,
      points: newRawPoints,
    });

    // 8. Create the 1m return annotation with the connected polyline's template
    const connectedRawAnnotation = await db.annotations.get(
      connectedAnnotation.id
    );
    const connectedTemplateId =
      connectedRawAnnotation?.annotationTemplateId;

    if (!connectedTemplateId) {
      dispatch(
        setToaster({
          message: "Connected polyline has no template",
          isError: true,
        })
      );
      return;
    }

    const connectedTemplate = await db.annotationTemplates.get(
      connectedTemplateId
    );

    // Create a new entity for the 1m return annotation
    const entity = await createEntity(newEntity);

    // The 1m annotation goes from contact point to split point
    const returnPoints = [
      { id: contactPointId, type: "square" },
      { id: splitPointId, type: "square" },
    ];

    await createAnnotation({
      id: nanoid(),
      entityId: entity.id,
      type: "POLYLINE",
      points: returnPoints,
      annotationTemplateId: connectedTemplateId,
      strokeColor: connectedTemplate?.strokeColor,
      strokeWidth: connectedTemplate?.strokeWidth,
      strokeWidthUnit: connectedTemplate?.strokeWidthUnit,
      fillColor: connectedTemplate?.fillColor,
      fillOpacity: connectedTemplate?.fillOpacity,
      closeLine: false,
      baseMapId,
      projectId,
      listingId: connectedRawAnnotation?.listingId ?? listingId,
    });

    // 9. Now hide the original 1m segment from the original annotation
    // The original annotation now has: [..., contact, splitPoint, other, ...]
    // We need to hide the segment between contact and splitPoint
    const updatedAnnotation = await db.annotations.get(annotationId);
    const updatedPoints = updatedAnnotation.points;

    let hideIdx = -1;
    for (let i = 0; i < updatedPoints.length - 1; i++) {
      if (
        updatedPoints[i].id === contactPointId &&
        updatedPoints[i + 1].id === splitPointId
      ) {
        hideIdx = i;
        break;
      }
      if (
        updatedPoints[i].id === splitPointId &&
        updatedPoints[i + 1].id === contactPointId
      ) {
        hideIdx = i;
        break;
      }
    }

    if (hideIdx !== -1) {
      const currentHidden = updatedAnnotation.hiddenSegmentsIdx || [];
      if (!currentHidden.includes(hideIdx)) {
        await updateAnnotation({
          ...updatedAnnotation,
          hiddenSegmentsIdx: [...currentHidden, hideIdx],
        });
      }
    }

    dispatch(triggerAnnotationsUpdate());
    dispatch(
      setToaster({
        message: "1m technical return created successfully",
        isError: false,
      })
    );
  };

  return { handleSegmentSplitCommit };
}
