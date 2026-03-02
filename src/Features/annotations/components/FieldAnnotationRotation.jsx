import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import computeWrapperBbox from "Features/mapEditor/utils/computeWrapperBbox";
import applyWrapperTransformToPoints from "Features/mapEditor/utils/applyWrapperTransformToPoints";
import commitWrapperTransform from "Features/mapEditor/services/commitWrapperTransform";

import FieldRotation from "Features/form/components/FieldRotation";

export default function FieldAnnotationRotation({ annotation }) {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const allAnnotations = useAnnotationsV2();
  const imageSize = baseMap?.image?.imageSize;

  // helpers

  const currentRotation = annotation?.rotation ?? 0;
  const displayRotation = Math.round(currentRotation * 10) / 10;

  // handlers

  async function commitRotation(targetRotation) {
    if (!annotation || !imageSize || !allAnnotations) return;

    // Round target to 1 decimal
    const target = Math.round(targetRotation * 10) / 10;
    const delta = target - currentRotation;
    if (Math.abs(delta) < 0.01) return;

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

  return <FieldRotation value={value} onChange={handleChange} />;
}
