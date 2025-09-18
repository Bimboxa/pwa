import { useDispatch, useSelector } from "react-redux";

import { setEditedAnnotation } from "../annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedAnnotationId } from "../annotationsSlice";
import { setIsEditingAnnotation } from "../annotationsSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";

import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

import { Box } from "@mui/material";

import BlockAnnotation from "./BlockAnnotation";
import FormAnnotation from "./FormAnnotation";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function SectionEditAnnotation() {
  const dispatch = useDispatch();

  // strings

  const saveS = "Enregistrer";

  // data
  const spriteImage = useAnnotationSpriteImage();
  const annotationTemplates = useLegendItems();

  const editedAnnotation = useSelector((s) => s.annotations.editedAnnotation);
  const selectedAnnotation = useSelectedAnnotation();
  const isEditingAnnotation = useSelector(
    (s) => s.annotations.isEditingAnnotation
  );

  // data - func

  const updateAnnotation = useUpdateAnnotation();

  // helper

  const annotation = isEditingAnnotation
    ? editedAnnotation
    : selectedAnnotation;

  // handlers

  function handleChange(annotation) {
    dispatch(setEditedAnnotation(annotation));
    dispatch(setIsEditingAnnotation(true));
  }

  function handleClose() {
    dispatch(setSelectedAnnotationId(null));
    dispatch(setEditedAnnotation({}));
    dispatch(setIsEditingAnnotation(false));
  }

  async function handleSave() {
    await updateAnnotation(annotation);
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "space-between", p: 1 }}>
        <BlockAnnotation
          annotation={annotation}
          spriteImage={spriteImage}
          annotationTemplates={annotationTemplates}
        />

        <IconButtonClose onClose={handleClose} />
      </Box>

      <FormAnnotation annotation={annotation} onChange={handleChange} />
      <ButtonInPanelV2
        label={saveS}
        onClick={handleSave}
        variant="contained"
        disabled={!isEditingAnnotation}
      />
    </BoxFlexVStretch>
  );
}
