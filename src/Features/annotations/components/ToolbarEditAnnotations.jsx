import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItems,
  removeSelectedItem,
  clearSelection,
} from "Features/selection/selectionSlice";

import { setWrapperMode } from "Features/mapEditor/mapEditorSlice";

import useDeleteAnnotation from "../hooks/useDeleteAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import getAnnotationQties from "../utils/getAnnotationQties";

import {
  Box,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DragIndicator as GripIcon,
  Close as RemoveIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "./DatagridAnnotations";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function ToolbarEditAnnotations({ allAnnotations, onDragStart }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const wrapperMode = useSelector((s) => s.mapEditor.wrapperMode);
  const deleteAnnotation = useDeleteAnnotation();
  const baseMap = useMainBaseMap();

  // state

  const [openDatagrid, setOpenDatagrid] = useState(false);

  // helpers - selected annotations

  const annotations = allAnnotations.filter((a) =>
    selectedItems.some((item) => item.nodeId === a.id)
  );

  const count = annotations.length;
  const countLabel = `${count} annotation${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`;

  // helpers - group by annotationTemplateId with aggregated quantities

  const templateGroups = useMemo(() => {
    const groups = new Map();
    const meterByPx = baseMap?.meterByPx;

    for (const annotation of annotations) {
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
          totalSurface: qties?.enabled ? (qties.surface || 0) : 0,
          totalLength: qties?.enabled ? (qties.length || 0) : 0,
          hasSurface: ["RECTANGLE", "POLYGON", "STRIP"].includes(annotation.type),
        });
      }
    }

    return Array.from(groups.values());
  }, [annotations, baseMap?.meterByPx]);

  // handlers

  function handleRemoveTemplateFromSelection(annotationIds) {
    for (const annotationId of annotationIds) {
      const item = selectedItems.find((i) => i.nodeId === annotationId);
      if (item) {
        dispatch(removeSelectedItem(item.id));
      }
    }
  }

  function handleCloneClick() {
    // TODO: bulk clone
  }

  function handleResizeClick() {
    dispatch(setWrapperMode(!wrapperMode));
  }

  async function handleDeleteClick() {
    for (const annotation of annotations) {
      await deleteAnnotation(annotation.id);
    }
    dispatch(clearSelection());
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Paper
        elevation={6}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          minWidth: 250,
        }}
      >
        {/* Header - draggable */}
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            cursor: "grab",
            userSelect: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <GripIcon fontSize="small" sx={{ color: "text.disabled", flexShrink: 0 }} />
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontSize: "0.8rem" }}
            >
              {countLabel}
            </Typography>
          </Box>
          <Tooltip title="Voir les données">
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setOpenDatagrid(true)}
              sx={{ flexShrink: 0 }}
            >
              <TableChartIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Template group rows */}
        <Box sx={{ py: 0.5 }}>
          {templateGroups.map((group) => (
            <TemplateGroupRow
              key={group.templateId}
              group={group}
              onRemove={() =>
                handleRemoveTemplateFromSelection(group.annotationIds)
              }
            />
          ))}
        </Box>

        <Divider />

        {/* Actions row */}
        <ToolbarAnnotationActions
          accentColor="#6366F1"
          onClone={handleCloneClick}
          onResize={handleResizeClick}
          resizeActive={wrapperMode}
          onDelete={handleDeleteClick}
        />
      </Paper>

      <DialogGeneric
        title={countLabel}
        open={openDatagrid}
        onClose={() => setOpenDatagrid(false)}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations annotations={annotations} />
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}

// --- Template group row within multi-selection toolbar ---

function TemplateGroupRow({ group, onRemove }) {
  // helpers

  const { annotation, count, totalSurface, totalLength, hasSurface } = group;
  const label = annotation?.annotationTemplateProps?.label || annotation?.label || "-";
  const countSuffix = count > 1 ? ` (×${count})` : "";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
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
              sx={{ fontSize: "0.8rem", fontWeight: 400, color: "text.secondary" }}
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
