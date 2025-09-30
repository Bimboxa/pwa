import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setEditedAnnotation } from "../annotationsSlice";
import {
  setEnabledDrawingMode,
  setSelectedNode,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedAnnotationId } from "../annotationsSlice";
import { setSelectedAnnotationTemplateId } from "Features/mapEditor/mapEditorSlice";
import { setIsEditingAnnotation } from "../annotationsSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";

import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

import { Box } from "@mui/material";

import BlockAnnotation from "./BlockAnnotation";
import FormAnnotation from "./FormAnnotation";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import SectionSelectorAnnotationTemplate from "./SectionSelectorAnnotationTemplate";

export default function SectionEditAnnotation() {
  const dispatch = useDispatch();

  // strings

  const saveS = "Enregistrer";

  // data
  const spriteImage = useAnnotationSpriteImage();
  const annotationTemplates = useAnnotationTemplates();

  const editedAnnotation = useSelector((s) => s.annotations.editedAnnotation);
  const selectedAnnotation = useSelectedAnnotation();
  const isEditingAnnotation = useSelector(
    (s) => s.annotations.isEditingAnnotation
  );

  const listingId = useSelector((s) => s.listings.selectedListingId);

  const tempAnnotationTemplateLabel = useSelector(
    (s) => s.annotations.tempAnnotationTemplateLabel
  );

  const selectedAnnotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );

  // effect - init editing when id change

  useEffect(() => {
    dispatch(setIsEditingAnnotation(false));
    dispatch(
      setSelectedAnnotationTemplateId(selectedAnnotation?.annotationTemplateId)
    );
  }, [selectedAnnotation?.id]);

  // effect - trigger edit if templateId change

  useEffect(() => {
    if (
      selectedAnnotationTemplateId !==
        selectedAnnotation?.annotationTemplateId &&
      !isEditingAnnotation
    ) {
      const template = annotationTemplates?.find(
        (t) => t.id === selectedAnnotationTemplateId
      );
      dispatch(setIsEditingAnnotation(true));
      dispatch(
        setEditedAnnotation({
          ...selectedAnnotation,
          annotationTemplateId: selectedAnnotationTemplateId,
          fillColor: template?.fillColor,
          iconKey: template?.iconKey,
        })
      );
    }
  }, [selectedAnnotationTemplateId]);

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

    dispatch(setSelectedNode(null));
  }

  async function handleSave() {
    await updateAnnotation(annotation, {
      tempAnnotationTemplateLabel,
      listingKey: listingId,
    });
    dispatch(setIsEditingAnnotation(false));
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

      <Box
        sx={{
          width: 1,
          overflow: "auto",
          height: "500px",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <SectionSelectorAnnotationTemplate />
      </Box>

      <FormAnnotation annotation={annotation} onChange={handleChange} />
      <ButtonInPanelV2
        label={saveS}
        onClick={handleSave}
        variant="contained"
        disabled={
          !isEditingAnnotation ||
          (!annotation?.annotationTemplateId && !tempAnnotationTemplateLabel)
        }
      />
    </BoxFlexVStretch>
  );
}
