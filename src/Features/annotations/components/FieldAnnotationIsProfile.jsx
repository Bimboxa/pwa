import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldCheck from "Features/form/components/FieldCheck";

// Flags the annotation as a PROFILE drawing: it then shows up in the
// "Choisir un profil" list of the elevation section editor, where its shape
// can be applied as the cross-section of a POLYLINE extrusion.
export default function FieldAnnotationIsProfile({ annotation }) {
  const dispatch = useDispatch();

  // handlers

  async function handleChange(checked) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, { isProfile: checked });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <FieldCheck
      value={Boolean(annotation?.isProfile)}
      onChange={handleChange}
      label="Profil"
      options={{ type: "switch", showAsSection: true }}
    />
  );
}
