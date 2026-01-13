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
import getImageAnnotationInitialBbox from "Features/imageAnnotations/utils/getImageAnnotationInitialBbox";

export default function ButtonDrawImage({ disabled }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Ajouter l'image";

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const createEntity = useCreateEntity();
  const baseMap = useMainBaseMap();
  const openedPanel = useSelector(s => s.listings.openedPanel);
  const selectedListingId = useSelector(s => s.listings.selectedListingId);

  // helper - isBaseMapAnnotation

  const isBaseMapAnnotation = openedPanel === "BASE_MAP_DETAIL";

  // helpers

  let override = {};
  if (disabled) override = { fillColor: "grey.300", strokeColor: "grey.300" }

  const annotation = { ...newAnnotation, ...override };

  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);

  // handler

  function handleClick() {
    setOpen(true);
    dispatch(setNewAnnotation({ ...newAnnotation, type: "IMAGE", annotationTemplateId: null }))
    //dispatch(setEnabledDrawingMode("ONE_CLICK"))
  }

  function handleImageChange(image) {
    setImage(image)
    console.log("image", image)
  }

  async function handleCreate() {

    const bbox = getImageAnnotationInitialBbox(
      {
        containerImageSize: baseMap.getImageSize(),
        imageSize: image.imageSize,
        asImageRatio: true,
      }
    )

    const annotation = {
      ...newAnnotation,
      type: "IMAGE",
      image: { file: image.file },
      baseMapId: baseMap.id,
      listingId: isBaseMapAnnotation ? null : selectedListingId,
      projectId: baseMap.projectId,
      bbox
    }

    if (isBaseMapAnnotation) annotation.isBaseMapAnnotation = true;

    // create annotation (as an entity)

    const entity = await createEntity(annotation, {
      listing: { id: baseMap.listingId, projectId: baseMap.projectId, table: "annotations" },
    })



    setOpen(false)
  }

  //if (!isBaseMapAnnotation) return null;


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
