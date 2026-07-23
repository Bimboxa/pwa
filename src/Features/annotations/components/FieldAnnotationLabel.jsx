import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldTextV2 from "Features/form/components/FieldTextV2";

// Editable annotation label (used a.o. to name "Profil" annotations picked in
// the elevation section editor). Committed on blur.
export default function FieldAnnotationLabel({ annotation }) {
  const dispatch = useDispatch();

  // handlers

  async function handleChange(label) {
    if (!annotation?.id) return;
    if ((annotation.label ?? "") === label) return;
    await db.annotations.update(annotation.id, { label });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <FieldTextV2
      label="Label"
      value={annotation?.label ?? ""}
      onChange={handleChange}
      options={{ showAsField: true, changeOnBlur: true, hideMic: true }}
    />
  );
}
