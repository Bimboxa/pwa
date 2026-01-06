import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";


import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box } from "@mui/material";

import { AddPhotoAlternate as AddImage } from "@mui/icons-material"
import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";
import SelectorImage from "Features/images/components/SelectorImage";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldImageV2 from "Features/form/components/FieldImageV2";
import ImageObject from "Features/images/js/ImageObject";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";


export default function ButtonDrawImage({ disabled }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Ajouter l'image";

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const createEntity = useCreateEntity();
  const baseMap = useMainBaseMap();
  const openedPanel = useSelector(s => s.listings.openedPanel);

  // helpers

  let override = {};
  if (disabled) override = { fillColor: "grey.300", strokeColor: "grey.300" }

  const annotation = { ...newAnnotation, ...override };

  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);

  // handler

  function handleClick() {
    setOpen(true);
    //dispatch(setNewAnnotation({ ...newAnnotation, type: "IMAGE" }))
    //dispatch(setEnabledDrawingMode("ONE_CLICK"))
  }

  function handleImageChange(image) {
    setImage(image)
    console.log("image", image)
  }

  async function handleCreate() {
    const annotation = {
      ...newAnnotation,
      type: "IMAGE",
      image: { file: image.file },
      baseMapId: baseMap.id,
      listingId: baseMap.listingId,
      projectId: baseMap.projectId,
    }

    if (openedPanel === "BASE_MAP_DETAIL") annotation.isBaseMapAnnotation = true;

    const entity = await createEntity(annotation, {
      listing: { id: baseMap.listingId, projectId: baseMap.projectId, table: "annotations" },
    })

    setOpen(false)
  }


  return (
    <>
      <IconButtonToolbarGeneric label="Image" size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
        <AddImage sx={{ color: annotation.fillColor || annotation.strokeColor }} />
      </IconButtonToolbarGeneric>

      <DialogGeneric open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 300 }}>
          <FieldImageV2 onChange={handleImageChange} value={image} />
        </Box>
        <BoxAlignToRight>
          <ButtonGeneric label={createS} onClick={handleCreate} />
        </BoxAlignToRight>

      </DialogGeneric>
    </>

  );
}
