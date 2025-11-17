import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setFilesDrop } from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setOpenDialogCreateEntity } from "Features/entities/entitiesSlice";

import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import Box from "@mui/material/Box";
import ImageGeneric from "Features/images/components/ImageGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ListAnnotationTemplates from "Features/annotations/components/ListAnnotationTemplates";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function DialogAutoSetNewAnnotationFromFilesDrop() {
  const dispatch = useDispatch();

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing();
  const filesDrop = useSelector((s) => s.mapEditor.filesDrop);
  const newEntity = useNewEntity();

  // data - func

  const createEntity = useCreateEntity();

  // state

  const [description, setDescription] = useState("");
  const [annotationTemplate, setAnnotationTemplate] = useState(null);

  // helper - open

  const open = Boolean(filesDrop);

  // helper - imageUrl;

  let imageUrl = null;
  if (filesDrop?.files?.[0]) {
    imageUrl = URL.createObjectURL(filesDrop?.files?.[0]);
  }

  // handlers

  function handleClose() {
    dispatch(setFilesDrop(null));
  }

  async function handleClick() {
    const imageFile = filesDrop?.files?.[0];
    const x = filesDrop?.x;
    const y = filesDrop?.y;
    const baseMapId = filesDrop?.baseMapId;
    const newAnnotation = {
      imageFile,
      x,
      y,
      baseMapId,
      ...getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate),
    };

    const entityData = { ...newEntity };
    if (description) entityData.description = description;

    const entity = await createEntity(entityData, {
      annotation: newAnnotation,
    });

    console.log("debug_2106_created_entity", entity);

    dispatch(setFilesDrop(null));
  }

  if (!open) return null;

  return (
    <DialogGeneric open={open} onClose={handleClose} width="300px">
      <ImageGeneric url={imageUrl} />
      <ListAnnotationTemplates
        annotationTemplates={annotationTemplates}
        onClick={setAnnotationTemplate}
        selection={annotationTemplate ? [annotationTemplate.id] : []}
      />
      <Box sx={{ py: 2, width: 1 }}>
        <FieldTextV2
          label="Description"
          value={description}
          onChange={setDescription}
          options={{ fullWidth: true, showLabel: true }}
        />
      </Box>

      <ButtonInPanelV2
        label="Créer"
        onClick={handleClick}
        variant="contained"
        color="secondary"
        disabled={!annotationTemplate}
      />
    </DialogGeneric>
  );
}
