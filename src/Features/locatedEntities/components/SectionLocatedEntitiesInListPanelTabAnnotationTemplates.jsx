import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { useDraggable, useDndMonitor, DragOverlay } from "@dnd-kit/core";

import {
  setNewAnnotation,
  setTempAnnotationTemplateLabel,
  setEditedAnnotationTemplate,
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
import useAnnotationTemplateCountById from "Features/annotations/hooks/useAnnotationTemplateCountById";

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
import IconButtonActionCreateAnnotationTemplate from "Features/annotations/components/IconButtonActionCreateAnnotationTemplate";

// Draggable component for annotation template item
function DraggableAnnotationTemplateItem({
  annotationTemplate,
  editedAnnotationTemplate,
  count,
  showAdd,
  editingId,
  hoveredId,
  spriteImage,
  onEditClick,
  onCreateClick,
  onMouseEnter,
  onMouseLeave,
  onSave,
  onCancel,
  onFormChange,
  onDelete,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `annotation-template-${annotationTemplate.id}`,
      data: {
        type: "annotationTemplate",
        annotationTemplateId: annotationTemplate.id,
      },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        opacity: isDragging ? 0 : 1,
      }}
    >
      <ListItemButton
        onClick={(e) => onEditClick(e, annotationTemplate)}
        divider
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        sx={{
          position: "relative",
          bgcolor: "white",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: isDragging ? "grabbing" : "grab",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AnnotationIcon
              annotation={annotationTemplate}
              spriteImage={spriteImage}
              size={18}
            />
          </Box>
          <Typography sx={{ mx: 1 }} variant="body2">
            {annotationTemplate.label}
          </Typography>
        </Box>

        <Box
          sx={{
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showAdd ? (
            <IconButton
              size="small"
              onClick={(e) => onCreateClick(e, annotationTemplate)}
            >
              <Add fontSize="small" />
            </IconButton>
          ) : (
            <Box>
              <Typography
                variant="body2"
                color={count > 0 ? "secondary.main" : "grey.200"}
              >
                {count}
              </Typography>
            </Box>
          )}
        </Box>
      </ListItemButton>
      <Collapse in={editingId === annotationTemplate.id}>
        <Box
          sx={{
            bgcolor: "background.default",
            position: "relative",
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <BoxAlignToRight>
            <IconButtonClose onClose={onCancel} />
          </BoxAlignToRight>

          <Box sx={{ p: 2, pt: 0 }}>
            <Box
              sx={{
                display: "flex",
                bgcolor: "white",
                borderRadius: 1,
              }}
            >
              <FormAnnotationTemplateVariantBlock
                annotationTemplate={editedAnnotationTemplate}
                onChange={onFormChange}
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
                onClick={() => onDelete(annotationTemplate)}
              />
              <ButtonGeneric label="Enregistrer" onClick={onSave} />
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export default function SectionLocatedEntitiesInListPanelTabAnnotationTemplates({
  onClose,
}) {
  const dispatch = useDispatch();

  const helperNoTemplateS = "Aucun modèle";
  const helperSelectS = "Sélectionnez un objet";

  // data

  const annotationTemplateCountById = useAnnotationTemplateCountById();
  const annotationTemplates = useAnnotationTemplatesBySelectedListing({
    //splitByIsFromAnnotation: true,
    sortByLabel: true,
  });

  const spriteImage = useAnnotationSpriteImage();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const resetSelection = useResetSelection();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const deleteAnnotationTemplate = useDeleteAnnotationTemplate();
  const editedAnnotationTemplate = useSelector(
    (s) => s.annotations.editedAnnotationTemplate
  );

  // state

  const [openCreate, setOpenCreate] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [activeDraggedTemplate, setActiveDraggedTemplate] = useState(null);

  // helper - editingId

  const editingId = editedAnnotationTemplate?.id;

  // Track drag state for overlay
  useDndMonitor({
    onDragStart(event) {
      const activeData = event.active.data.current;
      if (activeData?.type === "annotationTemplate") {
        const template = annotationTemplates?.find(
          (t) => t.id === activeData.annotationTemplateId
        );
        setActiveDraggedTemplate(template);
      }
    },
    onDragEnd() {
      setActiveDraggedTemplate(null);
    },
    onDragCancel() {
      setActiveDraggedTemplate(null);
    },
  });

  // handler

  async function handleSave() {
    await updateAnnotationTemplate(editedAnnotationTemplate);
    dispatch(setEditedAnnotationTemplate(null));
  }

  function handleCancel() {
    dispatch(setEditedAnnotationTemplate(null));
  }

  function handleEditClick(e, annotationTemplate) {
    e.stopPropagation();
    dispatch(
      setEditedAnnotationTemplate(
        editingId === annotationTemplate.id ? null : annotationTemplate
      )
    );
  }

  function handleFormChange(updatedTemplate) {
    dispatch(setEditedAnnotationTemplate(updatedTemplate));
  }

  async function handleDelete(annotationTemplate) {
    await deleteAnnotationTemplate(annotationTemplate.id);
    dispatch(setEditedAnnotationTemplate(null));
  }

  function handleCreateClick(e, annotationTemplate) {
    e.stopPropagation();
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

    dispatch(setSelectedAnnotationTemplateId(annotationTemplate?.id));

    // Close context menu if provided
    if (onClose) onClose();
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

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <IconButtonAnnotationTemplatesDownload />
          <IconButtonAnnotationTemplatesUpload />
        </Box>
        <IconButtonActionCreateAnnotationTemplate />
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List sx={{}}>
          {annotationTemplates?.map((annotationTemplate, idx) => {
            const count =
              annotationTemplateCountById?.[annotationTemplate.id] || 0;
            const showAdd = hoveredId === annotationTemplate.id;
            if (!annotationTemplate?.isDivider)
              return (
                <DraggableAnnotationTemplateItem
                  key={annotationTemplate.id}
                  annotationTemplate={annotationTemplate}
                  editedAnnotationTemplate={editedAnnotationTemplate}
                  count={count}
                  showAdd={showAdd}
                  editingId={editingId}
                  hoveredId={hoveredId}
                  spriteImage={spriteImage}
                  onEditClick={handleEditClick}
                  onCreateClick={handleCreateClick}
                  onMouseEnter={() => setHoveredId(annotationTemplate.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onFormChange={handleFormChange}
                  onDelete={handleDelete}
                />
              );
            if (annotationTemplate?.isDivider && idx !== 0)
              return <Box key={idx} sx={{ my: 1 }} />;
            return null;
          })}
        </List>
      </BoxFlexVStretch>

      <DragOverlay>
        {activeDraggedTemplate ? (
          <Box
            sx={{
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AnnotationIcon
              annotation={activeDraggedTemplate}
              spriteImage={spriteImage}
              size={24}
            />
          </Box>
        ) : null}
      </DragOverlay>
    </BoxFlexVStretch>
  );
}
