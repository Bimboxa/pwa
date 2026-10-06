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
import { toggleAnnotationTemplateHidden } from "Features/scopeVisibility/scopeVisibilitySlice";
import {
  formatTemplateQtiesLine,
  formatTemplateQtiesTooltip,
} from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";

// ---------------------------------------------------------------------------
// RowPanelDrawingTemplate — one template row of the Dessin panel: hover drag
// handle, icon + label, quantities line, split draw button, eye toggle and a
// chevron. Clicking the row opens the template detail view (its annotations
// list, #311). `qties` may carry the parts painted in 3D with the template
// (mergePaintedQtiesIntoTemplateQties): they add to the totals, the line
// counts them ("· 3 faces") and its tooltip splits the two sources.
// ---------------------------------------------------------------------------

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
  // Viewer module: no draw entry points (split button, L/P badges, Auto
  // procedure chip) — the row keeps the eye and the detail navigation.
  readOnly,
}) {
  const dispatch = useDispatch();

  // data

  // Linked ANNOTATIONS_CREATOR procedures — same "Auto" chip + popper as the
  // popper row (the panel is the only Dessin entry point of the procedures).
  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
  const linkedProcedures = (annotationTemplate?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);
  const hasProcedure = linkedProcedures.length > 0 && !readOnly;
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [procedureAnchorEl, setProcedureAnchorEl] = useState(null);
  const procedurePopperCloseTimer = useRef(null);
  const procedurePopperRef = useRef(null);
  const procedurePopperHoveredRef = useRef(false);

  // helpers

  const isHidden = Boolean(annotationTemplate?.hidden);
  // No annotation nor painted part yet: a plain "0 annot" line, dimmed to
  // light grey.
  const hasQties = Boolean(
    qties?.unit || qties?.length || qties?.surface || qties?.paintedListedCount
  );
  const qtyLine = formatTemplateQtiesLine(qties);
  const qtyTooltip = formatTemplateQtiesTooltip(qties) ?? "";
  // Something counted (annotations or painted parts): colored main quantity.
  const hasCounted = (qties?.count ?? 0) + (qties?.paintedCount ?? 0) > 0;

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

  // Template eye: per-scope local state (scopeVisibility slice).
  const handleToggleHidden = (e) => {
    e.stopPropagation();
    dispatch(toggleAnnotationTemplateHidden(annotationTemplate?.id));
  };

  const handleOpenDetail = () => {
    dispatch(setDetailTemplateId(annotationTemplate.id));
  };

  // render

  const visibilityButton = (
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
  );

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
            {/* readOnly (Viewer): the label wraps instead of being truncated */}
            <Typography
              variant="body2"
              noWrap={!readOnly}
              color={isHidden ? "text.disabled" : "text.primary"}
              sx={{
                fontWeight: 600,
                userSelect: "none",
                ...(readOnly && { overflowWrap: "anywhere", minWidth: 0 }),
              }}
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
          <Tooltip title={qtyTooltip} placement="bottom-start">
            <Typography
              variant="caption"
              noWrap
              sx={{
                display: "block",
                fontFamily: "monospace",
                fontWeight: 500,
                color:
                  isHidden || !hasQties ? "text.disabled" : "text.secondary",
              }}
            >
              {qtyLine}
            </Typography>
          </Tooltip>
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
        {!readOnly && (
          <SplitButtonStartDraw
            annotationTemplate={annotationTemplate}
            listingId={listingId}
          />
        )}

        {/* Visibility toggle — in readOnly (Viewer) mode the slot shows the
            main quantity and swaps to the eye on hover, like the popper. The
            quantity stays in the layout (hidden) under the eye so the slot
            width — and the wrapped label — does not move on hover. */}
        {readOnly ? (
          <Box
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Typography
              align="right"
              noWrap
              sx={{
                minWidth: 40,
                px: 0.5,
                fontSize: "10px",
                fontFamily: "monospace",
                fontWeight: 500,
                visibility: isHovered ? "hidden" : "visible",
              }}
              color={
                isHidden
                  ? "text.disabled"
                  : hasCounted
                    ? "secondary.main"
                    : "panel.countEmpty"
              }
            >
              {qties?.mainQtyLabel ?? ""}
            </Typography>
            {isHovered && (
              <Box
                sx={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                }}
              >
                {visibilityButton}
              </Box>
            )}
          </Box>
        ) : (
          visibilityButton
        )}

        {/* Chevron — opens the template detail view (row click) */}
        <ChevronRight
          sx={{ fontSize: 18, color: "panel.textLight", flexShrink: 0 }}
        />
      </Box>
    </Box>
  );
}
