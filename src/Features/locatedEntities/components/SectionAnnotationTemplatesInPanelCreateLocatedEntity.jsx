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
import useDeleteAnnotationTemplate from "Features/annotations/hooks/useDeleteAnnotationTemplate";

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
import IconButtonClose from "Features/layout/components/IconButtonClose";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

import IconButtonAnnotationTemplatesDownload from "Features/annotations/components/IconButtonAnnotationTemplatesDownload";
import IconButtonAnnotationTemplatesUpload from "Features/annotations/components/IconButtonAnnotationTemplatesUpload";

export default function SectionAnnotationTemplatesInPanelCreateLocatedEntity() {
  const dispatch = useDispatch();

  const helperNoTemplateS = "Aucun modèle";
  const helperSelectS = "Sélectionnez un objet";

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing({
    //splitByIsFromAnnotation: true,
    sortByLabel: true,
  });

  console.log("debug_2810_annotationTemplates", annotationTemplates);

  const spriteImage = useAnnotationSpriteImage();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const resetSelection = useResetSelection();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const deleteAnnotationTemplate = useDeleteAnnotationTemplate();

  // state

  const [openCreate, setOpenCreate] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [editedAnnotationTemplate, setEditedAnnotationTemplate] =
    useState(null);

  // helpers

  const noTemplates = !annotationTemplates?.length > 0;

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

  async function handleDelete(annotationTemplate) {
    setEditingId(null);
    setEditedAnnotationTemplate(null);
    await deleteAnnotationTemplate(annotationTemplate.id);
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
      {/* {noTemplates && (
        <Box sx={{ p: 2 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ userSelect: "none" }}
          >
            {helperNoTemplateS}
          </Typography>
        </Box>
      )} */}

      <Box sx={{ display: "flex", gap: 1, p: 1 }}>
        <IconButtonAnnotationTemplatesDownload />
        <IconButtonAnnotationTemplatesUpload />
      </Box>

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
                  <Typography sx={{ mx: 1 }} variant="body2">
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
                  <Box
                    sx={{
                      bgcolor: "background.default",
                      position: "relative",
                      borderBottom: (theme) =>
                        `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <BoxAlignToRight>
                      <IconButtonClose onClose={handleCancel} />
                    </BoxAlignToRight>

                    <Box sx={{ p: 2, pt: 0 }}>
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
                          justifyContent: "space-between",
                          mt: 1,
                        }}
                      >
                        <ButtonGeneric
                          label="Supprimer"
                          onClick={() => handleDelete(annotationTemplate)}
                        />
                        <ButtonGeneric
                          label="Enregistrer"
                          onClick={handleSave}
                        />
                      </Box>
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            );
          if (annotationTemplate?.isDivider && idx !== 0)
            return <Box key={idx} sx={{ my: 1 }} />;
        })}
        <ListItemButton onClick={() => setOpenCreate(true)} divider>
          <Add fontSize="small" />
          <Typography sx={{ ml: 1 }} variant="body2">
            Nouveau modèle
          </Typography>
        </ListItemButton>
        <Collapse in={openCreate}>
          <Box
            sx={{
              bgcolor: "background.default",
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
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
