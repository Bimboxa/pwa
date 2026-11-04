import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import computeWrapperBbox from "Features/mapEditor/utils/computeWrapperBbox";
import applyWrapperTransformToPoints from "Features/mapEditor/utils/applyWrapperTransformToPoints";
import commitWrapperTransform from "Features/mapEditor/services/commitWrapperTransform";
import moveMeshPaintsWithBboxHostService from "Features/meshPaint/services/moveMeshPaintsWithBboxHostService";
import {
  bboxCenterPx,
  bboxHostRotationAffine,
} from "Features/meshPaint/utils/buildBboxHostAffine";

import FieldRotation from "Features/form/components/FieldRotation";

export default function FieldAnnotationRotation({ annotation, inline }) {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const allAnnotations = useAnnotationsV2({
    caller: "FieldAnnotationRotation",
  });
  const imageSize = baseMap?.image?.imageSize;

  // helpers

  const currentRotation = annotation?.rotation ?? 0;
  const displayRotation = Math.round(currentRotation * 10) / 10;
  const isBboxAnnotation =
    annotation?.type === "IMAGE" ||
    annotation?.type === "RECTANGLE" ||
    annotation?.type === "OBJECT_3D";

  // handlers

  async function commitRotation(targetRotation) {
    if (!annotation || !imageSize || !allAnnotations) return;

    // Round target to 1 decimal
    const target = Math.round(targetRotation * 10) / 10;
    const delta = target - currentRotation;
    if (Math.abs(delta) < 0.01) return;

    // Bbox-based annotations (IMAGE, RECTANGLE, OBJECT_3D): no points to
    // rotate, just update the rotation field. The painted parts of an
    // OBJECT_3D (« Pinceau » 3D) turn with it about the bbox center — one
    // undo step with the host (no-op for the other types: never painted).
    if (isBboxAnnotation) {
      let newRotation = target % 360;
      if (newRotation < 0) newRotation += 360;
      const meterByPx = baseMap?.getMeterByPx?.();
      await withUndoGroup(() =>
        db.transaction("rw", db.annotations, db.meshPaints, async () => {
          await db.annotations.update(annotation.id, { rotation: newRotation });
          if (annotation.type !== "OBJECT_3D" || !annotation.bbox) return;
          await moveMeshPaintsWithBboxHostService({
            hostId: annotation.id,
            host: annotation,
            affine: bboxHostRotationAffine({
              deltaDeg: delta,
              center: bboxCenterPx(annotation.bbox),
            }),
            imageSize,
            metrics:
              meterByPx > 0
                ? {
                    imageWidth: imageSize.width,
                    imageHeight: imageSize.height,
                    meterByPx,
                  }
                : null,
          });
        })
      );
      dispatch(triggerAnnotationsUpdate());
      return;
    }

    const rotCenter = annotation.rotationCenter ?? null;
    const hasExistingRotation = currentRotation !== 0 && rotCenter != null;

    // Compute wrapper bbox — canonical (un-rotated) if already rotated
    const wrapperBbox = hasExistingRotation
      ? computeWrapperBbox([annotation], currentRotation, rotCenter)
      : computeWrapperBbox([annotation]);

    if (!wrapperBbox) return;

    // Rotate all points by delta around bbox center
    const pointUpdates = applyWrapperTransformToPoints({
      annotations: [annotation],
      wrapperBbox,
      deltaPos: { x: delta, y: 0 },
      partType: "ROTATE",
    });

    // Commit: updates points + sets rotation + creates rotationCenter on first rotation
    await commitWrapperTransform({
      selectedAnnotationIds: [annotation.id],
      allAnnotations,
      pointUpdates,
      imageSize,
      rotationDelta: delta,
      wrapperBbox,
    });

    dispatch(triggerAnnotationsUpdate());
  }

  async function handleChange(newValue) {
    // FieldRotation already debounces typing (400ms) and fires immediately for step/reset
    const raw = newValue.rotation;
    const parsed = typeof raw === "number" ? raw : parseFloat(raw);
    if (isNaN(parsed)) return;

    await commitRotation(parsed);
  }

  // render

  const value = { rotation: displayRotation };

  return (
    <FieldRotation value={value} onChange={handleChange} inline={inline} />
  );
}
