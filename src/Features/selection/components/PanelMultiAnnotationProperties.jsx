import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import {
  selectSelectedItems,
  removeSelectedItem,
  clearSelection,
} from "../selectionSlice";

import { Box, Typography, IconButton, Button, Tooltip } from "@mui/material";
import {
  ArrowBack as Back,
  Delete as DeleteIcon,
  Close as RemoveIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import AnnotationMeasurements from "Features/annotations/components/AnnotationMeasurements";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useAnnotations from "Features/annotations/hooks/useAnnotations";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

export default function PanelMultiAnnotationProperties() {
  // strings

  const captionS = "Sélection multiple";
  const deleteS = "Supprimer";

  // data

  const dispatch = useDispatch();
  const selectedItems = useSelector(selectSelectedItems);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const annotations = useAnnotations({ filterByBaseMapId: baseMapId });
  const baseMap = useMainBaseMap();
  const deleteAnnotation = useDeleteAnnotation();

  // state

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // helpers

  const selectedAnnotations = useMemo(() => {
    if (!annotations) return [];
    return annotations.filter((a) =>
      selectedItems.some((item) => item.nodeId === a.id)
    );
  }, [annotations, selectedItems]);

  const count = selectedAnnotations.length;
  const title = `${count} annotation${count > 1 ? "s" : ""}`;

  const templateGroups = useMemo(() => {
    const groups = new Map();
    const meterByPx = baseMap?.meterByPx;

    for (const annotation of selectedAnnotations) {
      const key = annotation.annotationTemplateId || annotation.id;
      const existing = groups.get(key);
      const qties = getAnnotationQties({ annotation, meterByPx });

      if (existing) {
        existing.annotationIds.push(annotation.id);
        existing.count += 1;
        if (qties?.enabled) {
          existing.totalSurface += qties.surface || 0;
          existing.totalLength += qties.length || 0;
        }
      } else {
        groups.set(key, {
          templateId: key,
          annotation,
          annotationIds: [annotation.id],
          count: 1,
          totalSurface: qties?.enabled ? qties.surface || 0 : 0,
          totalLength: qties?.enabled ? qties.length || 0 : 0,
          hasSurface: ["RECTANGLE", "POLYGON", "STRIP"].includes(
            annotation.type
          ),
        });
      }
    }

    return Array.from(groups.values());
  }, [selectedAnnotations, baseMap?.meterByPx]);

  // handlers

  function handleBack() {
    dispatch(clearSelection());
  }

  function handleRemoveTemplateFromSelection(annotationIds) {
    for (const annotationId of annotationIds) {
      const item = selectedItems.find((i) => i.nodeId === annotationId);
      if (item) {
        dispatch(removeSelectedItem(item.id));
      }
    }
  }

  async function handleDeleteConfirm() {
    for (const annotation of selectedAnnotations) {
      await deleteAnnotation(annotation.id);
    }
    dispatch(clearSelection());
    setOpenDeleteDialog(false);
  }

  // render

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {title}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 1,
          overflow: "auto",
        }}
      >
        {/* Card 1: Template groups */}
        <WhiteSectionGeneric>
          {templateGroups.map((group) => (
            <TemplateGroupRow
              key={group.templateId}
              group={group}
              onRemove={() =>
                handleRemoveTemplateFromSelection(group.annotationIds)
              }
            />
          ))}
        </WhiteSectionGeneric>

        {/* Card 2: Delete */}
        <WhiteSectionGeneric>
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={() => setOpenDeleteDialog(true)}
            fullWidth
            size="small"
          >
            {deleteS}
          </Button>
        </WhiteSectionGeneric>
      </Box>

      <DialogDeleteRessource
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        onConfirmAsync={handleDeleteConfirm}
      />
    </BoxFlexVStretch>
  );
}

// --- Template group row ---

function TemplateGroupRow({ group, onRemove }) {
  // helpers

  const { annotation, count, totalSurface, totalLength, hasSurface } = group;
  const label =
    annotation?.annotationTemplateProps?.label || annotation?.label || "-";
  const countSuffix = count > 1 ? ` (×${count})` : "";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.75,
        "&:hover": { bgcolor: "action.hover" },
        transition: "background 0.1s",
      }}
    >
      <AnnotationTemplateIcon template={annotation || {}} size={16} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
          {countSuffix && (
            <Typography
              component="span"
              variant="body2"
              sx={{
                fontSize: "0.8rem",
                fontWeight: 400,
                color: "text.secondary",
              }}
            >
              {countSuffix}
            </Typography>
          )}
        </Typography>
        <AnnotationMeasurements
          surface={hasSurface && totalSurface > 0 ? totalSurface : null}
          length={totalLength > 0 ? totalLength : null}
        />
      </Box>

      <Tooltip title="Retirer de la sélection">
        <IconButton
          size="small"
          onClick={onRemove}
          sx={{
            flexShrink: 0,
            color: "text.disabled",
            "&:hover": { color: "error.main", bgcolor: "error.lighter" },
          }}
        >
          <RemoveIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
