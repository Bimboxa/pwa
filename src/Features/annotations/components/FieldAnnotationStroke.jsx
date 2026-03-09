import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldStroke from "Features/form/components/FieldStroke";

export default function FieldAnnotationStroke({ annotation, overrideFields }) {
  const dispatch = useDispatch();

  // helpers

  const strokeValue = {
    strokeColor: annotation?.strokeColor ?? "#000000",
    strokeType: annotation?.strokeType ?? "SOLID",
    strokeOpacity: annotation?.strokeOpacity ?? 1,
    strokeWidth: annotation?.strokeWidth ?? 1,
    strokeWidthUnit: annotation?.strokeWidthUnit ?? "PX",
  };

  // handlers

  async function handleChange(newValue) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, {
      strokeColor: newValue.strokeColor,
      strokeType: newValue.strokeType,
      strokeOpacity: newValue.strokeOpacity,
      strokeWidth: newValue.strokeWidth,
      strokeWidthUnit: newValue.strokeWidthUnit,
    });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return <FieldStroke value={strokeValue} onChange={handleChange} disabledFields={overrideFields} />;
}
