import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import FieldTextV2 from "Features/form/components/FieldTextV2";

// FREE_TEXT annotation text — the `textContent` own prop (NOT `label`).
// Multiline, committed on blur.
export default function FieldAnnotationTextContent({ annotation }) {
  const dispatch = useDispatch();

  // handlers

  async function handleChange(textContent) {
    if (!annotation?.id) return;
    if ((annotation.textContent ?? "") === textContent) return;
    await db.annotations.update(annotation.id, { textContent });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <FieldTextV2
      label="Texte"
      value={annotation?.textContent ?? ""}
      onChange={handleChange}
      options={{
        showAsField: true,
        changeOnBlur: true,
        hideMic: true,
        multiline: true,
        placeholder: "Texte",
        fullWidth: true,
      }}
    />
  );
}
