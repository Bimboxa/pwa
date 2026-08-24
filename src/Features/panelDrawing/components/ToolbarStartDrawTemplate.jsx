import { useState, useMemo, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Paper,
  Box,
  Divider,
  Popover,
  Typography,
  IconButton,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { CompactPicker } from "react-color";

import { setDraftPropsForTemplate } from "Features/mapEditor/mapEditorSlice";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import FieldAnnotationThickness from "Features/annotations/components/FieldAnnotationThickness";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useDrawFromTemplate from "Features/mapEditor/hooks/useDrawFromTemplate";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getDraftFieldVisibility from "Features/mapEditor/utils/getDraftFieldVisibility";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";
import {
  DRAWING_TOOL_HOTKEYS,
  getHotkeyForToolInGroup,
} from "Features/mapEditor/constants/drawingToolHotkeys";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import theme from "Styles/theme";

// ---------------------------------------------------------------------------
// ToolbarStartDrawTemplate — floating toolbar above the bottom bar while the
// Dessin panel shows a template's annotations list (2D editor, no drawing
// mode armed): same controls as ToolbarDrawingDraft (color when not locked
// by the template, tool variants, height / thickness / offset / width
// fields) operating on a PREVIEW draft. Edits are persisted per template
// (mapEditor.draftPropsByTemplateId) so starting the draw — from a tool
// here, the panel's split button or the L/P hotkeys — applies them. Once a
// draw is armed, ToolbarDrawingDraft takes over (this one returns null).
// ---------------------------------------------------------------------------

function ToolbarContent({ template }) {
  const dispatch = useDispatch();

  // strings

  const drawS = "Dessiner";

  // state

  const [colorAnchorEl, setColorAnchorEl] = useState(null);
  const thicknessRef = useRef(null);
  const heightRef = useRef(null);

  // data

  const { tools, selectToolAndDraw } = useDrawFromTemplate(
    template,
    template.listingId
  );
  const rememberedDraftProps = useSelector(
    (s) => s.mapEditor.draftPropsByTemplateId?.[template.id]
  );

  // helpers - preview draft (NOT dispatched — the real draft is built by
  // startDraw with the same function, remembered props included)

  const draft = useMemo(
    () =>
      getNewAnnotationPropsFromAnnotationTemplate(
        template,
        rememberedDraftProps
      ),
    [template, rememberedDraftProps]
  );

  const drawingShape = draft?.drawingShape;
  const shapeCategory = drawingShape
    ? resolveShapeCategory(drawingShape)
    : null;
  const isStrokeColor =
    shapeCategory === "polyline" || drawingShape === "REVOLUTION_AXIS";
  const colorField = isStrokeColor ? "strokeColor" : "fillColor";
  const color = getAnnotationColor(draft) ?? theme.palette.secondary.main;
  const colorPopoverTitle = isStrokeColor
    ? "Couleur de tracé"
    : "Couleur de remplissage";

  // Same visibility rules as ToolbarDrawingDraft (no tool group / ramp here —
  // the enabled mode is null in this pre-draw state).
  const {
    isFieldOverridden,
    showThickness,
    showOffset,
    showHeight,
    showWidth,
  } = getDraftFieldVisibility(draft, null);
  const showColor = !isFieldOverridden(colorField);
  const showAnyField = showThickness || showOffset || showHeight || showWidth;

  const options = tools.map((tool) => {
    const { key, label, Icon } = tool;
    const hotkey = getHotkeyForToolInGroup(tool, tools);
    return {
      key,
      label,
      icon: (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <Icon sx={{ color }} />
          {hotkey && (
            <Box
              sx={{
                position: "absolute",
                bottom: -7,
                right: -8,
                minWidth: 12,
                height: 12,
                px: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "3px",
                bgcolor: "background.paper",
                fontSize: 8,
                fontWeight: 700,
                lineHeight: 1,
                color: "text.secondary",
              }}
            >
              {hotkey}
            </Box>
          )}
        </Box>
      ),
    };
  });

  // handlers

  // Persist the edited props per template — the next startDraw (tool below,
  // split button, L/P hotkeys) restores them (REMEMBERABLE_DRAFT_KEYS).
  function rememberProps(props) {
    dispatch(setDraftPropsForTemplate({ templateId: template.id, props }));
  }

  function handleToolChange(toolKey) {
    if (!toolKey) return;
    const tool = tools.find((t) => t.key === toolKey);
    if (tool) selectToolAndDraw(tool);
  }

  function handleColorChange(picked) {
    rememberProps({ [colorField]: picked.hex });
  }

  // effect - pre-draw keyboard shortcuts, mirroring the in-draw ones: the
  // tool letters (R / L / C / K / …) arm the draw with that tool, E / H focus
  // the thickness / height fields. Capture phase + stopPropagation so these
  // letters win over the global namespace (module switch, O/X/C, L/P) while
  // this toolbar is displayed; unhandled keys pass through untouched.

  useEffect(() => {
    const isEditableTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const focusField = (ref) => {
      const input = ref.current?.querySelector("input");
      if (!input) return false;
      input.focus();
      input.select?.();
      return true;
    };

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      const letter = e.key?.toLowerCase();

      // Tool letters: same resolution as the badges (first tool of the
      // behavior within the group).
      const behavior = DRAWING_TOOL_HOTKEYS[letter];
      if (behavior) {
        const tool = tools.find((t) => t.behavior === behavior);
        if (tool) {
          e.preventDefault();
          e.stopPropagation();
          selectToolAndDraw(tool);
          return;
        }
      }

      if (letter === "e" && showThickness && focusField(thicknessRef)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (letter === "h" && showHeight && focusField(heightRef)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [tools, selectToolAndDraw, showThickness, showHeight]);

  // render

  if (options.length === 0) return null;

  return (
    <Paper
      elevation={6}
      sx={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        borderRadius: 2,
        px: 1,
        py: 0.5,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        maxWidth: "calc(100vw - 32px)",
        overflowX: "auto",
        zIndex: 110,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          flexShrink: 0,
          mr: 0.5,
        }}
      >
        <AnnotationTemplateIcon template={template} size={18} />
        <Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              lineHeight: 1.2,
              fontSize: "0.65rem",
            }}
          >
            {drawS}
          </Typography>
          <Typography
            variant="body2"
            noWrap
            sx={{ fontWeight: 600, lineHeight: 1.2, maxWidth: 160 }}
          >
            {template.label}
          </Typography>
        </Box>
      </Box>

      {showColor && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box
            onClick={(e) => setColorAnchorEl(e.currentTarget)}
            sx={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              flexShrink: 0,
              bgcolor: color,
              cursor: "pointer",
              border: "2px solid",
              borderColor: "divider",
              transition: "transform 0.2s",
              "&:hover": { transform: "scale(1.1)" },
            }}
          />
        </>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <ToggleSingleSelectorGeneric
        options={options}
        selectedKey={null}
        onChange={handleToolChange}
      />

      {showAnyField && (
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      )}

      {showWidth && (
        <FieldAnnotationHeight
          annotation={draft}
          onChange={(next) => rememberProps({ width: next.width })}
          field="width"
          label="larg."
        />
      )}
      {showThickness && (
        <Box ref={thicknessRef} sx={{ display: "contents" }}>
          <FieldAnnotationThickness
            annotation={draft}
            onChange={(next) =>
              rememberProps({
                strokeWidth: next.strokeWidth,
                strokeWidthUnit: next.strokeWidthUnit,
              })
            }
            shortcut="E"
          />
        </Box>
      )}
      {showOffset && (
        <FieldAnnotationHeight
          annotation={draft}
          onChange={(next) => rememberProps({ offsetZ: next.offsetZ })}
          field="offsetZ"
          label="Offset"
        />
      )}
      {showHeight && (
        <Box ref={heightRef} sx={{ display: "contents" }}>
          <FieldAnnotationHeight
            annotation={draft}
            onChange={(next) => rememberProps({ height: next.height })}
            shortcut="H"
          />
        </Box>
      )}

      <Popover
        open={Boolean(colorAnchorEl)}
        anchorEl={colorAnchorEl}
        onClose={() => setColorAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              mb: 1,
              p: 0,
              overflow: "hidden",
              borderRadius: 2,
              boxShadow: 6,
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pl: 2,
            pr: 1,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: "bold" }}>
            {colorPopoverTitle}
          </Typography>
          <IconButton size="small" onClick={() => setColorAnchorEl(null)}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
        <Box sx={{ p: 1 }}>
          <CompactPicker color={color} onChange={handleColorChange} />
        </Box>
      </Popover>
    </Paper>
  );
}

export default function ToolbarStartDrawTemplate() {
  // data

  const isDessinModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "MAP"
  );
  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const detailTemplateId = useSelector((s) => s.panelDrawing.detailTemplateId);
  const detailView = useSelector((s) => s.panelDrawing.detailView);

  const annotationTemplates = useAnnotationTemplates();

  // helpers

  const show =
    isDessinModule &&
    !isThreedEditor &&
    leftPanelDocked &&
    !enabledDrawingMode &&
    !pasteClipboard &&
    detailView === "ANNOTATIONS" &&
    Boolean(detailTemplateId);

  const template = show
    ? (annotationTemplates ?? []).find((t) => t.id === detailTemplateId)
    : null;

  // render

  if (!template) return null;

  return <ToolbarContent template={template} />;
}
