import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldCheck from "Features/form/components/FieldCheck";

// Exterior-side guide flag. The displayed value is the RESOLVED one
// (annotation value, falling back to its template's isExt); toggling writes
// an explicit per-annotation value, which then wins over the template.
export default function FieldAnnotationIsExt({ annotation }) {
  const dispatch = useDispatch();

  // handlers

  async function handleChange(checked) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, { isExt: checked });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <FieldCheck
      value={Boolean(annotation?.isExt)}
      onChange={handleChange}
      label="Extérieur"
      options={{ type: "switch", showAsSection: true }}
    />
  );
}
