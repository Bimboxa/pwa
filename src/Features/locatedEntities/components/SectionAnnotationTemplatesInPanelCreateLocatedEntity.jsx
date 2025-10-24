import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setNewAnnotation,
  setTempAnnotationTemplateLabel,
} from "Features/annotations/annotationsSlice";

import {
  setEnabledDrawingMode,
  setSelectedAnnotationTemplateId,
} from "Features/mapEditor/mapEditorSlice";

import useResetSelection from "Features/selection/hooks/useResetSelection";
import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";

import {
  List,
  ListItemButton,
  Typography,
  Box,
  Divider,
  ListItemIcon,
  IconButton,
  Collapse,
} from "@mui/material";
import { Add, Edit } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import AnnotationIcon from "Features/annotations/components/AnnotationIcon";
import FormAnnotationTemplateVariantBlock from "Features/annotations/components/FormAnnotationTemplateVariantBlock";

import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import SectionCreateAnnotationTemplateVariantBlock from "Features/annotations/components/SectionCreateAnnotationTemplateVariantBlock.jsx";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function SectionAnnotationTemplatesInPanelCreateLocatedEntity() {
  const dispatch = useDispatch();

  const newS = "Nouveau modèle";

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing({
    splitByIsFromAnnotation: true,
    sortByLabel: true,
  });
  const spriteImage = useAnnotationSpriteImage();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const resetSelection = useResetSelection();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // state

  const [openCreate, setOpenCreate] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [editedAnnotationTemplate, setEditedAnnotationTemplate] =
    useState(null);

  // handler

  async function handleSave() {
    await updateAnnotationTemplate(editedAnnotationTemplate);
    setEditingId(null);
    setEditedAnnotationTemplate(null);
  }

  function handleCancel() {
    setEditingId(null);
    setEditedAnnotationTemplate(null);
  }

  function handleEditClick(e, annotationTemplate) {
    e.stopPropagation();
    if (editingId === annotationTemplate.id) {
      setEditingId(null);
    } else {
      setEditingId(annotationTemplate.id);
      setEditedAnnotationTemplate(annotationTemplate);
    }
  }

  function handleFormChange(updatedTemplate) {
    setEditedAnnotationTemplate(updatedTemplate);
  }

  function handleClick(annotationTemplate) {
    console.log("annotationTemplate", annotationTemplate);

    resetSelection();

    dispatch(setEnabledDrawingMode(annotationTemplate.type));
    dispatch(
      setNewAnnotation({
        ...newAnnotation,
        ...getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate),
        isFromAnnotation: false,
      })
    );
    dispatch(setTempAnnotationTemplateLabel(annotationTemplate?.label));
    dispatch(setSelectedAnnotationTemplateId(annotationTemplate?.id));
  }

  // render

  return (
    <BoxFlexVStretch>
      <List sx={{ bgcolor: "white" }}>
        {annotationTemplates?.map((annotationTemplate, idx) => {
          if (!annotationTemplate?.isDivider)
            return (
              <Box key={annotationTemplate.id}>
                <ListItemButton
                  onClick={() => handleClick(annotationTemplate)}
                  divider
                  onMouseEnter={() => setHoveredId(annotationTemplate.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  sx={{ position: "relative" }}
                >
                  <AnnotationIcon
                    annotation={annotationTemplate}
                    spriteImage={spriteImage}
                    size={18}
                  />
                  <Typography sx={{ ml: 1, flex: 1 }} variant="body2">
                    {annotationTemplate.label}
                  </Typography>

                  <IconButton
                    size="small"
                    onClick={(e) => handleEditClick(e, annotationTemplate)}
                    sx={{
                      ml: 1,
                      visibility:
                        hoveredId === annotationTemplate.id
                          ? "visible"
                          : "hidden",
                    }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </ListItemButton>
                <Collapse in={editingId === annotationTemplate.id}>
                  <Box sx={{ p: 2, bgcolor: "background.default" }}>
                    <Box
                      sx={{
                        display: "flex",
                        p: 1,
                        bgcolor: "white",
                        borderRadius: 1,
                      }}
                    >
                      <FormAnnotationTemplateVariantBlock
                        annotationTemplate={editedAnnotationTemplate}
                        onChange={handleFormChange}
                      />
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                        justifyContent: "flex-end",
                        mt: 1,
                      }}
                    >
                      <ButtonGeneric label="Annuler" onClick={handleCancel} />
                      <ButtonGeneric label="Enregistrer" onClick={handleSave} />
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            );
          if (annotationTemplate?.isDivider)
            return <Box key={idx} sx={{ my: 1 }} />;
        })}
        <ListItemButton onClick={() => setOpenCreate(true)} divider>
          <Add fontSize="small" />
          <Typography sx={{ ml: 1 }} variant="body2">
            Nouveau modèle
          </Typography>
        </ListItemButton>
        <Collapse in={openCreate}>
          <Box sx={{ p: 1, bgcolor: "background.default" }}>
            <SectionCreateAnnotationTemplateVariantBlock
              onCreated={() => setOpenCreate(false)}
              onCancel={() => setOpenCreate(false)}
            />
          </Box>
        </Collapse>
      </List>
    </BoxFlexVStretch>
  );
}
