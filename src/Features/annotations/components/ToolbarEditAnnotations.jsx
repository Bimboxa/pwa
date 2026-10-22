import { useEffect, useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItems,
  removeSelectedItem,
  clearSelection,
} from "Features/selection/selectionSlice";

import useDeleteAnnotations from "../hooks/useDeleteAnnotations";
import useUpdateAnnotations from "../hooks/useUpdateAnnotations";
import useAnnotationTemplateCandidates, {
  isTemplateCompatibleWithAnnotation,
} from "../hooks/useAnnotationTemplateCandidates";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import stringifyAnnotationData from "../utils/stringifyAnnotationData";
import getAnnotationQties from "../utils/getAnnotationQties";
import getAnnotationAnglesCount from "../utils/getAnnotationAnglesCount";
import getAnnotationTemplateChangeUpdates from "../utils/getAnnotationTemplateChangeUpdates";

import {
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DragIndicator as GripIcon,
  Close as RemoveIcon,
  TableChart as TableChartIcon,
  BugReport as BugReportIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import FieldAnnotationIsExtSwitch from "./FieldAnnotationIsExtSwitch";
import Shape3DBatchSelector from "./Shape3DBatchSelector";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import ChipLayerSelector from "Features/layers/components/ChipLayerSelector";
import SectionZonesBandInToolbar from "Features/zonings/components/SectionZonesBandInToolbar";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "./DatagridAnnotations";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

// Properties toolbar of SEVERAL selected annotations (template groups,
// batch height / offset / isExt / 3D shape, layer, delete). The annotation
// COMMANDS (Dupliquer, Fusionner, Découper…) live in the unified commands
// toolbar (Features/commandsToolbar).
export default function ToolbarEditAnnotations({
  allAnnotations,
  onDragStart,
}) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const deleteAnnotations = useDeleteAnnotations();
  const baseMap = useMainBaseMap();

  // helpers - selected annotations

  const annotations = useMemo(
    () =>
      allAnnotations.filter((a) =>
        selectedItems.some((item) => item.nodeId === a.id)
      ),
    [allAnnotations, selectedItems]
  );

  // Template candidates of the WHOLE selection (union over the selected
  // rows): a mixed RULER + COTE selection sees both families; the chosen
  // template is then applied to the compatible rows only.
  const { candidates: sameTypeCandidates, listings: sameTypeListings } =
    useAnnotationTemplateCandidates(annotations, { variant: "sameType" }) ?? {};
  const updateAnnotations = useUpdateAnnotations();

  // state

  const [openDatagrid, setOpenDatagrid] = useState(false);
  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);
  const [pendingHeight, setPendingHeight] = useState(null);
  const [pendingOffsetZ, setPendingOffsetZ] = useState(null);
  const [pendingIsExt, setPendingIsExt] = useState(null);

  const count = annotations.length;
  const countLabel = `${count} annotation${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`;

  // helpers - batch height

  // Distinct heights among the current selection (undefined treated as a value)
  const heightValues = [...new Set(annotations.map((a) => a.height))];
  const heightsAreUniform = heightValues.length === 1;
  const allPolygons =
    count > 0 && annotations.every((a) => a.type === "POLYGON");
  const heightDisplayValue = heightsAreUniform
    ? (heightValues[0] ?? "")
    : allPolygons
      ? "Epaisseurs variables"
      : "Hauteurs variables";

  // Stable signature so the field remounts (resets its internal localValue)
  // when the selection changes.
  const selectionKey = annotations
    .map((a) => a.id)
    .sort()
    .join(",");

  // Only a finite number is a committable height.
  const canApplyHeight =
    typeof pendingHeight === "number" && Number.isFinite(pendingHeight);

  // helpers - batch offsetZ (elevation of the annotation base, metres)

  const offsetZValues = [...new Set(annotations.map((a) => a.offsetZ))];
  const offsetZAreUniform = offsetZValues.length === 1;
  const offsetZDisplayValue = offsetZAreUniform
    ? (offsetZValues[0] ?? "")
    : "Offsets variables";
  const canApplyOffsetZ =
    typeof pendingOffsetZ === "number" && Number.isFinite(pendingOffsetZ);

  // Batch isExt (exterior-side flag) only targets polylines / strips;
  // the switch shows ON when ALL targets are flagged. Toggling only stages
  // the value (pendingIsExt); "Appliquer" persists it.
  const isExtTargets = annotations.filter(
    (a) => a.type === "POLYLINE" || a.type === "STRIP" || a.type === "POLYGON"
  );
  const allTargetsAreExt =
    isExtTargets.length > 0 && isExtTargets.every((a) => a.isExt);
  const canApplyIsExt =
    typeof pendingIsExt === "boolean" && pendingIsExt !== allTargetsAreExt;
  const canApplyBatch = canApplyHeight || canApplyIsExt || canApplyOffsetZ;

  // helpers - group by annotationTemplateId with aggregated quantities

  const templateGroups = useMemo(() => {
    const groups = new Map();
    const meterByPx = baseMap?.meterByPx;

    for (const annotation of annotations) {
      const key = annotation.annotationTemplateId || annotation.id;
      const existing = groups.get(key);

      const qties = getAnnotationQties({ annotation, meterByPx });

      // Intrinsic unit count (LINEAR_LAYOUT: number of bars) — other types
      // don't carry one, their ×N suffix already shows the annotation count.
      const unitCount =
        qties?.enabled && Number.isFinite(qties.count) ? qties.count : 0;

      // Corner count — null for types other than POLYLINE / STRIP.
      const anglesCount = getAnnotationAnglesCount(annotation);

      if (existing) {
        existing.annotationIds.push(annotation.id);
        existing.count += 1;
        if (annotation.isMesh3d) existing.hasMesh3d = true;
        if (qties?.enabled) {
          existing.totalSurface += qties.surface || 0;
          existing.totalLength += qties.length || 0;
          existing.totalLayoutLength += qties.layoutLength || 0;
          existing.totalUnits += unitCount;
        }
        if (anglesCount != null) {
          existing.hasAngles = true;
          existing.totalAngles += anglesCount;
        }
      } else {
        groups.set(key, {
          templateId: key,
          annotation,
          annotationIds: [annotation.id],
          count: 1,
          // A mesh 3D annotation voids the group's surface / length total.
          hasMesh3d: Boolean(annotation.isMesh3d),
          totalSurface: qties?.enabled ? qties.surface || 0 : 0,
          totalLength: qties?.enabled ? qties.length || 0 : 0,
          totalLayoutLength: qties?.enabled ? qties.layoutLength || 0 : 0,
          totalUnits: unitCount,
          hasAngles: anglesCount != null,
          totalAngles: anglesCount ?? 0,
          hasSurface: ["RECTANGLE", "POLYGON", "STRIP"].includes(
            annotation.type
          ),
        });
      }
    }

    return Array.from(groups.values());
  }, [annotations, baseMap?.meterByPx]);

  // handlers

  // Reset the pending values whenever the selection changes
  useEffect(() => {
    setPendingHeight(null);
    setPendingOffsetZ(null);
    setPendingIsExt(null);
  }, [selectionKey]);

  // Field onChange only stores the pending value; it does NOT persist.
  function handleBatchHeightFieldChange(updated) {
    setPendingHeight(updated?.height);
  }

  function handleBatchOffsetZFieldChange(updated) {
    setPendingOffsetZ(updated?.offsetZ);
  }

  async function handleApplyBatch() {
    if (!canApplyBatch || annotations.length === 0) return;
    // Merge height + offsetZ (all annotations) and isExt (polylines /
    // strips only) into a single update per annotation.
    const updatesById = new Map();
    if (canApplyHeight) {
      for (const a of annotations) {
        updatesById.set(a.id, { id: a.id, height: pendingHeight });
      }
    }
    if (canApplyOffsetZ) {
      for (const a of annotations) {
        const update = updatesById.get(a.id) ?? { id: a.id };
        update.offsetZ = pendingOffsetZ;
        updatesById.set(a.id, update);
      }
    }
    if (canApplyIsExt) {
      for (const a of isExtTargets) {
        const update = updatesById.get(a.id) ?? { id: a.id };
        update.isExt = pendingIsExt;
        updatesById.set(a.id, update);
      }
    }
    await updateAnnotations([...updatesById.values()]);
    setPendingHeight(null);
    setPendingOffsetZ(null);
    setPendingIsExt(null);
  }

  function handleRemoveTemplateFromSelection(annotationIds) {
    for (const annotationId of annotationIds) {
      const item = selectedItems.find((i) => i.nodeId === annotationId);
      if (item) {
        dispatch(removeSelectedItem(item.id));
      }
    }
  }

  function handleTemplateDropdownClick(event) {
    event.stopPropagation();
    setTemplateAnchorEl(event.currentTarget);
  }

  function handleTemplateDropdownClose() {
    setTemplateAnchorEl(null);
  }

  // helpers - template change targets

  // Selected rows a candidate template may be assigned to (same shape).
  function getTemplateTargets(template) {
    return annotations.filter((a) =>
      isTemplateCompatibleWithAnnotation(a, template, { variant: "sameType" })
    );
  }

  // The selection's common template, when it has exactly one.
  const templateIds = [
    ...new Set(annotations.map((a) => a.annotationTemplateId)),
  ];
  const commonTemplateId = templateIds.length === 1 ? templateIds[0] : null;

  // Mixed selection: not every candidate applies to every selected row, so
  // each row of the menu shows how many annotations it would affect.
  const isMixedSelection =
    count > 1 &&
    (sameTypeCandidates ?? []).some(
      (t) => getTemplateTargets(t).length !== count
    );

  async function handleTemplateChange(annotationTemplateId) {
    const template = sameTypeCandidates?.find(
      (t) => t.id === annotationTemplateId
    );
    if (!template) return;

    // Diff-only patch per row (same path as the single-selection toolbar):
    // template fields the merge actually changed, the new template's ids and
    // lock set, `type` only when it changes, and a templateless row ("Dessin"
    // tool) becomes a regular listing annotation. Incompatible rows of a
    // mixed selection are left untouched.
    const updates = getTemplateTargets(template)
      .map((annotation) =>
        getAnnotationTemplateChangeUpdates({ annotation, template, baseMap })
      )
      .filter(Boolean);
    if (updates.length > 0) await updateAnnotations(updates);
    handleTemplateDropdownClose();
  }

  async function handleDeleteClick() {
    await deleteAnnotations(annotations.map((a) => a.id));
    dispatch(clearSelection());
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: 0,
        maxHeight: "100%",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          minWidth: 250,
          // The header and the bottom tools stay pinned: only the template
          // group list scrolls, so a large selection never pushes the actions
          // row off screen.
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          maxHeight: "100%",
        }}
      >
        {/* Header - draggable */}
        <Box
          onMouseDown={onDragStart}
          sx={{
            flexShrink: 0,
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
            <GripIcon
              fontSize="small"
              sx={{ color: "text.disabled", flexShrink: 0 }}
            />
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontSize: "0.8rem" }}
            >
              {countLabel}
            </Typography>
          </Box>
          <Tooltip title="Copy annotations data">
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (annotations?.length > 0) {
                  // imageSize + meterByPx make the export self-contained for
                  // the AI meshing prompt (docs/annotations/MESH_IMPORT_PROMPT.md)
                  const data = stringifyAnnotationData({
                    imageSize: baseMap?.getImageSize?.() ?? null,
                    meterByPx:
                      baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx ?? null,
                    annotations,
                  });
                  navigator.clipboard.writeText(data);
                }
              }}
              sx={{
                flexShrink: 0,
                color: "text.disabled",
                opacity: 0.4,
                "&:hover": { opacity: 1, bgcolor: "action.hover" },
              }}
            >
              <BugReportIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
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

        {/* Template group rows - the only scrollable area of the toolbar */}
        <Box
          sx={{
            pt: 0.5,
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
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

        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 1.25,
            py: 0.5,
          }}
        >
          <Tooltip title="Changer le modèle">
            <IconButton
              size="small"
              onClick={handleTemplateDropdownClick}
              sx={{
                borderRadius: 1,
                fontSize: "0.75rem",
                color: "text.secondary",
                "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              }}
            >
              <ArrowDropDownIcon sx={{ fontSize: 18, mr: 0.25 }} />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                Changer le modèle
              </Typography>
            </IconButton>
          </Tooltip>
        </Box>

        <Divider sx={{ flexShrink: 0 }} />

        {/* Batch height + offsetZ */}
        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 1.25,
            py: 0.75,
          }}
        >
          <FieldAnnotationHeight
            key={selectionKey}
            annotation={{
              id: "batch-height",
              height: heightDisplayValue,
              ...(allPolygons && { type: "POLYGON" }),
            }}
            onChange={handleBatchHeightFieldChange}
          />
          <FieldAnnotationHeight
            key={`${selectionKey}-offsetZ`}
            annotation={{ id: "batch-offsetZ", offsetZ: offsetZDisplayValue }}
            onChange={handleBatchOffsetZFieldChange}
            field="offsetZ"
            label="Offset"
          />
          {isExtTargets.length > 0 && (
            <FieldAnnotationIsExtSwitch
              checked={pendingIsExt ?? allTargetsAreExt}
              onChange={setPendingIsExt}
            />
          )}
          <Button
            size="small"
            variant="outlined"
            disabled={!canApplyBatch}
            onClick={handleApplyBatch}
            sx={{ flexShrink: 0 }}
          >
            Appliquer
          </Button>
        </Box>

        {/* Batch 3D shape (e.g. revolution from a shared axis) */}
        <Box sx={{ flexShrink: 0 }}>
          <Shape3DBatchSelector annotations={annotations} />
        </Box>

        <Divider sx={{ flexShrink: 0 }} />

        {/* Actions row */}
        <Box sx={{ flexShrink: 0 }}>
          <ToolbarAnnotationActions
            accentColor="#6366F1"
            hideClone
            hideResize
            onDelete={handleDeleteClick}
            layerChip={
              annotations.length > 0 ? (
                <ChipLayerSelector
                  annotationIds={annotations.map((a) => a.id)}
                  annotations={annotations}
                  baseMapId={baseMap?.id}
                />
              ) : null
            }
          />

          {/* Zones band (ZONES module): link the selection to zones */}
          <SectionZonesBandInToolbar annotations={annotations} />
        </Box>

        {/* Template change menu (same type) */}
        <Menu
          open={Boolean(templateAnchorEl)}
          anchorEl={templateAnchorEl}
          onClose={handleTemplateDropdownClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
        >
          <SelectorAnnotationTemplateVariantDense
            selectedAnnotationTemplateId={commonTemplateId}
            onChange={handleTemplateChange}
            annotationTemplates={sameTypeCandidates}
            listings={sameTypeListings}
            getItemSuffix={
              isMixedSelection
                ? (t) => `· ${getTemplateTargets(t).length}`
                : null
            }
          />
        </Menu>
      </Paper>

      <DialogGeneric
        title={countLabel}
        open={openDatagrid}
        onClose={() => setOpenDatagrid(false)}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations
            annotations={annotations}
            onClose={() => setOpenDatagrid(false)}
          />
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}

// --- Template group row within multi-selection toolbar ---

function TemplateGroupRow({ group, onRemove }) {
  // helpers

  const {
    annotation,
    count,
    totalSurface,
    totalLength,
    totalLayoutLength,
    totalUnits,
    hasAngles,
    totalAngles,
    hasSurface,
    hasMesh3d,
  } = group;
  const label =
    annotation?.annotationTemplateProps?.label || annotation?.label || "-";
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
          surface={
            !hasMesh3d && hasSurface && totalSurface > 0 ? totalSurface : null
          }
          length={!hasMesh3d && totalLength > 0 ? totalLength : null}
          layoutLength={
            !hasMesh3d && totalLayoutLength > 0 ? totalLayoutLength : null
          }
          units={totalUnits > 0 ? totalUnits : null}
          mesh3d={hasMesh3d}
          angles={hasAngles ? totalAngles : null}
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
