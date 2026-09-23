import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { setImageChangeAnnotationId } from "Features/mapEditor/mapEditorSlice";

import { Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldImageV2 from "Features/form/components/FieldImageV2";

import useUpdateAnnotationImage from "Features/annotations/hooks/useUpdateAnnotationImage";

// "Changer l'image" from the IMAGE overlay toolbar: pick a new image for the
// annotation whose id sits in mapEditor.imageChangeAnnotationId.
export default function DialogChangeAnnotationImage() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Changer l'image";
  const applyS = "Appliquer";

  // data

  const annotationId = useSelector((s) => s.mapEditor.imageChangeAnnotationId);
  const annotation = useLiveQuery(
    async () => (annotationId ? db.annotations.get(annotationId) : null),
    [annotationId]
  );
  const updateAnnotationImage = useUpdateAnnotationImage();

  // state

  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  // handlers

  function handleClose() {
    setImage(null);
    dispatch(setImageChangeAnnotationId(null));
  }

  async function handleApply() {
    if (!annotation || !image?.file) return;
    setSaving(true);
    try {
      await updateAnnotationImage(annotation, image);
    } finally {
      setSaving(false);
      handleClose();
    }
  }

  // render

  return (
    <DialogGeneric
      width={360}
      open={Boolean(annotationId)}
      onClose={handleClose}
      title={titleS}
    >
      <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <FieldImageV2 value={image} onChange={setImage} />
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <ButtonGeneric
            label={applyS}
            onClick={handleApply}
            variant="contained"
            color="secondary"
            disabled={!image?.file || !annotation || saving}
          />
        </Box>
      </Box>
    </DialogGeneric>
  );
}
