import { useSelector, useDispatch } from "react-redux";

import { setFilesDrop } from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setOpenDialogCreateEntity } from "Features/entities/entitiesSlice";

import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ListAnnotationTemplates from "Features/annotations/components/ListAnnotationTemplates";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function DialogAutoSetNewAnnotationFromFilesDrop() {
  const dispatch = useDispatch();

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing();
  const filesDrop = useSelector((s) => s.mapEditor.filesDrop);
  const newEntity = useNewEntity();

  // data - func

  const createEntity = useCreateEntity();

  // helper - open

  const open = Boolean(filesDrop);

  // handlers

  function handleClose() {
    dispatch(setFilesDrop(null));
  }

  async function handleClick(annotationTemplate) {
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

    const entity = await createEntity(newEntity, { annotation: newAnnotation });

    console.log("debug_2106_created_entity", entity);

    dispatch(setFilesDrop(null));
  }

  if (!open) return null;

  return (
    <DialogGeneric open={open} onClose={handleClose}>
      <ListAnnotationTemplates
        annotationTemplates={annotationTemplates}
        onClick={handleClick}
      />
    </DialogGeneric>
  );
}
