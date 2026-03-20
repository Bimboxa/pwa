import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldCheck from "Features/form/components/FieldCheck";

export default function FieldAnnotationIsEraser({ annotation }) {
  const dispatch = useDispatch();

  // handlers

  async function handleChange(checked) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, { isEraser: checked });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <FieldCheck
      value={Boolean(annotation?.isEraser)}
      onChange={handleChange}
      label="Gomme"
      options={{ type: "switch", showAsSection: true }}
    />
  );
}
