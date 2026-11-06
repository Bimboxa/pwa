import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldCheck from "Features/form/components/FieldCheck";

// « Ne pas montrer en 3D »: the annotation stays in the 2D editors, the
// listings and the quantities, but is left out of the 3D scene
// (annotation.hiddenIn3d, dropped by useAnnotationsV2 `excludeHiddenIn3d`
// — the 3D scene loader). For a drawing aid that only makes sense on its
// sheet, e.g. an orientation mark on a page of profiles.
export default function FieldAnnotationHiddenIn3d({ annotation }) {
  const dispatch = useDispatch();

  // handlers

  async function handleChange(checked) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, { hiddenIn3d: checked });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <FieldCheck
      value={Boolean(annotation?.hiddenIn3d)}
      onChange={handleChange}
      label="Ne pas montrer en 3D"
      options={{ type: "switch", showAsSection: true }}
    />
  );
}
