import { useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setDetailTemplateId } from "Features/panelDrawing/panelDrawingSlice";

import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  Chip,
  Popper,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ProcedurePopperContent from "Features/annotationsAuto/components/ProcedurePopperContent";
import SplitButtonStartDraw from "./SplitButtonStartDraw";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import { getFreeAnnotationShortcut } from "Features/mapEditor/constants/freeAnnotationShortcuts";

// ---------------------------------------------------------------------------
// RowPanelDrawingTemplate — one template row of the Dessin panel: hover drag
// handle, icon + label, quantities line, split draw button, eye toggle and a
// chevron. Clicking the row opens the template detail view (its annotations
// list, #311).
// ---------------------------------------------------------------------------

function formatQty(value, decimals = 2) {
  return Number.isFinite(value) && value !== 0 ? value.toFixed(decimals) : "0";
}

export default function RowPanelDrawingTemplate({
  annotationTemplate,
  listingId,
  qties,
  spriteImage,
  sortableRef,
  sortableStyle,
  sortableAttributes,
  dragListeners,
  dndEnabled,
}) {
  const dispatch = useDispatch();

  // data

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // Linked ANNOTATIONS_CREATOR procedures — same "Auto" chip + popper as the
  // popper row (the panel is the only Dessin entry point of the procedures).
  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
  const linkedProcedures = (annotationTemplate?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);
  const hasProcedure = linkedProcedures.length > 0;
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [procedureAnchorEl, setProcedureAnchorEl] = useState(null);
  const procedurePopperCloseTimer = useRef(null);
  const procedurePopperRef = useRef(null);
  const procedurePopperHoveredRef = useRef(false);

  // helpers

  const isHidden = Boolean(annotationTemplate?.hidden);
  const freeShortcut = getFreeAnnotationShortcut(annotationTemplate);
  const qtyLine = `${formatQty(qties?.unit ?? 0, 0)} u · ${formatQty(
    qties?.length ?? 0
  )} ml · ${formatQty(qties?.surface ?? 0)} m²`;

  // handlers

  // Keep the procedure popper open while hovering the chip OR the popper
  // itself, with a small close delay to bridge the gap between them (same
  // mechanism as the popper row).
  const openProcedurePopper = (e) => {
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
    setProcedureAnchorEl(e.currentTarget);
  };
  const cancelCloseProcedurePopper = () => {
    procedurePopperHoveredRef.current = true;
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
  };
  const scheduleCloseProcedurePopper = () => {
    procedurePopperHoveredRef.current = false;
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
    procedurePopperCloseTimer.current = setTimeout(() => {
      if (procedurePopperRef.current?.contains(document.activeElement)) return;
      setProcedureAnchorEl(null);
    }, 150);
  };
  const handleProcedurePopperBlur = () => {
    if (!procedurePopperHoveredRef.current) scheduleCloseProcedurePopper();
  };

  const handleToggleHidden = async (e) => {
    e.stopPropagation();
    await updateAnnotationTemplate({
      ...annotationTemplate,
      hidden: !annotationTemplate?.hidden,
    });
  };

  const handleOpenDetail = () => {
    dispatch(setDetailTemplateId(annotationTemplate.id));
  };

  // render

  return (
    <Box
      ref={sortableRef}
      style={sortableStyle}
      {...(sortableAttributes ?? {})}
    >
      <Box
        onClick={handleOpenDetail}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 0.25,
          pr: 0.5,
          py: 1,
          cursor: "pointer",
          bgcolor: "background.paper",
          "&:hover": { bgcolor: "action.hover" },
          "&:not(:last-child)": {
            borderBottom: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {/* Drag handle (hover, "Tous" filter only) */}
        <Box
          {...(dndEnabled ? (dragListeners ?? {}) : {})}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: dndEnabled ? "grab" : "default",
            opacity: dndEnabled && isHovered ? 1 : 0,
            transition: "opacity 0.15s",
            flexShrink: 0,
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 16, color: "panel.textLight" }} />
        </Box>

        {/* Icon */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            flexShrink: 0,
            opacity: isHidden ? 0.4 : 1,
            filter: isHidden ? "grayscale(100%)" : "none",
          }}
        >
          <AnnotationTemplateIcon
            template={annotationTemplate}
            size={20}
            spriteImage={spriteImage}
          />
        </Box>

        {/* Label + quantities */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography
              variant="body2"
              noWrap
              color={isHidden ? "text.disabled" : "text.primary"}
              sx={{ fontWeight: 600, userSelect: "none" }}
            >
              {annotationTemplate.label}
              {annotationTemplate.height != null && (
                <Typography
                  component="span"
                  sx={{ fontSize: "10px", color: "text.secondary", ml: 0.5 }}
                >
                  [ht. {annotationTemplate.height}m]
                </Typography>
              )}
            </Typography>
            {freeShortcut && (
              <Box sx={{ flexShrink: 0 }}>
                <ShortcutBadge>{freeShortcut}</ShortcutBadge>
              </Box>
            )}
            {hasProcedure && (
              <Chip
                label="Auto"
                size="small"
                onMouseEnter={openProcedurePopper}
                onMouseLeave={scheduleCloseProcedurePopper}
                sx={{
                  flexShrink: 0,
                  height: 16,
                  "& .MuiChip-label": {
                    px: 0.5,
                    fontSize: "9px",
                    fontWeight: "bold",
                  },
                }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              fontFamily: "monospace",
              fontWeight: 500,
              color: isHidden ? "text.disabled" : "text.secondary",
            }}
          >
            {qtyLine}
          </Typography>
        </Box>

        {hasProcedure && (
          <Popper
            open={Boolean(procedureAnchorEl)}
            anchorEl={procedureAnchorEl}
            placement="bottom-start"
            style={{ zIndex: 2000 }}
            modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
          >
            <Box
              ref={procedurePopperRef}
              onMouseEnter={cancelCloseProcedurePopper}
              onMouseLeave={scheduleCloseProcedurePopper}
              onBlurCapture={handleProcedurePopperBlur}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <ProcedurePopperContent
                procedures={linkedProcedures}
                sourceTemplate={annotationTemplate}
                baseMapId={selectedBaseMapId}
              />
            </Box>
          </Popper>
        )}

        {/* Split draw button */}
        <SplitButtonStartDraw
          annotationTemplate={annotationTemplate}
          listingId={listingId}
        />

        {/* Visibility toggle */}
        <Tooltip title={isHidden ? "Afficher" : "Masquer"} arrow>
          <IconButton
            size="small"
            onClick={handleToggleHidden}
            sx={{
              p: 0.5,
              color: isHidden ? "secondary.main" : "panel.iconMuted",
            }}
          >
            {isHidden ? (
              <VisibilityOff sx={{ fontSize: 16 }} />
            ) : (
              <Visibility sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Chevron — opens the template detail view (row click) */}
        <ChevronRight
          sx={{ fontSize: 18, color: "panel.textLight", flexShrink: 0 }}
        />
      </Box>
    </Box>
  );
}
