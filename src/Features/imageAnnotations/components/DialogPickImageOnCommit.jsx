import { useState } from "react";

import { Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldImageV2 from "Features/form/components/FieldImageV2";

import getImageRefFromEntityImage from "../utils/getImageRefFromEntityImage";

// Dialog of the IMAGE_PICK commit interceptor: an IMAGE template without a
// default image was clicked on the map. Pick the image (file / paste / drop),
// then the parked commit resumes with the File in the draft; cancel drops the
// commit (nothing written, the tool stays armed).
export default function DialogPickImageOnCommit({ pending, onResume, onCancel }) {
  // strings

  const titleS = "Image de l'annotation";
  const placeS = "Placer";

  // state

  const [image, setImage] = useState(null);

  // handlers

  function handlePlaceClick() {
    const ref = getImageRefFromEntityImage(image);
    if (!ref) return;
    onResume({
      newAnnotation: { ...pending.newAnnotation, image: ref },
    });
  }

  // render

  return (
    <DialogGeneric
      width={360}
      open={Boolean(pending)}
      onClose={onCancel}
      title={titleS}
    >
      <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <FieldImageV2 value={image} onChange={setImage} />
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <ButtonGeneric
            label={placeS}
            onClick={handlePlaceClick}
            variant="contained"
            color="secondary"
            disabled={!image?.file}
          />
        </Box>
      </Box>
    </DialogGeneric>
  );
}
