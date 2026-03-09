import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldFill from "Features/form/components/FieldFill";

export default function FieldAnnotationFill({ annotation, overrideFields }) {
  const dispatch = useDispatch();

  // helpers

  const fillValue = {
    fillColor: annotation?.fillColor ?? "#ffffff",
    fillType: annotation?.fillType ?? "SOLID",
    fillOpacity: annotation?.fillOpacity ?? 1,
  };

  // handlers

  async function handleChange(newValue) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, {
      fillColor: newValue.fillColor,
      fillType: newValue.fillType,
      fillOpacity: newValue.fillOpacity,
    });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return <FieldFill value={fillValue} onChange={handleChange} disabledFields={overrideFields} />;
}
