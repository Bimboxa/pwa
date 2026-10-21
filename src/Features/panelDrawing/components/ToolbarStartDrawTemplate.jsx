import { useState, useMemo, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Box, Divider, Popover, Typography, IconButton } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { CompactPicker } from "react-color";

import { setDraftPropsForTemplate } from "Features/mapEditor/mapEditorSlice";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import PaperEditorBottomToolbar from "Features/layout/components/PaperEditorBottomToolbar";
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
import { selectDrawingToolsEditor } from "Features/meshPaint/utils/meshBrushSelectors";
import { DRAWING_TOOLS_EDITOR_3D } from "Features/mapEditor/utils/filterDrawingToolsForEditor";
import { selectBaseMapsGridDessinOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridDessin";

import theme from "Styles/theme";

// ---------------------------------------------------------------------------
// ToolbarStartDrawTemplate — floating toolbar at the bottom of the displayed
// editor (PaperEditorBottomToolbar, mounted in SectionViewer's editors area)
// while the Dessin panel shows a template's detail (no drawing mode armed) —
// in the 2D editor, or in the 3D editor for the shapes drawable there
// (useDrawFromTemplate.canDrawInCurrentEditor; the toolbar stays hidden for
// the others, e.g. MARKER). Same controls as ToolbarDrawingDraft (color when not locked
// by the template, tool variants, height / thickness / offset / width
// fields) operating on a PREVIEW draft. Edits are persisted per template
// (mapEditor.draftPropsByTemplateId) so starting the draw — from a tool
// here, the panel's split button or the L/P hotkeys — applies them. Once a
// draw is armed, ToolbarDrawingDraft takes over (this one returns null).
// In 3D, P stays the walk-mode toggle (useWalkMode): the « Pinceau » keeps
// its button but gets no P badge, and the letter passes through here.
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

  const { tools, selectToolAndDraw, canDrawInCurrentEditor } =
    useDrawFromTemplate(template, template.listingId);
  const rememberedDraftProps = useSelector(
    (s) => s.mapEditor.draftPropsByTemplateId?.[template.id]
  );
  // 3D editor of the Dessin module: P belongs to the walk-mode toggle.
  const isThreedTools =
    useSelector(selectDrawingToolsEditor) === DRAWING_TOOLS_EDITOR_3D;

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
    const hotkey =
      isThreedTools && tool.behavior === "MESH_BRUSH"
        ? null
        : getHotkeyForToolInGroup(tool, tools);
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
      // 3D: P is the walk-mode toggle, never the « Pinceau » shortcut.
      if (isThreedTools && letter === "p") return;

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
  }, [tools, selectToolAndDraw, showThickness, showHeight, isThreedTools]);

  // render

  // Shape not drawable in the displayed (3D) editor: no toolbar, like before.
  if (!canDrawInCurrentEditor) return null;
  if (options.length === 0) return null;

  return (
    <PaperEditorBottomToolbar>
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
            sx={{ fontWeight: 600, lineHeight: 1.2 }}
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
    </PaperEditorBottomToolbar>
  );
}

export default function ToolbarStartDrawTemplate() {
  // data

  const isDessinModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "MAP"
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const detailTemplateId = useSelector((s) => s.panelDrawing.detailTemplateId);
  const detailView = useSelector((s) => s.panelDrawing.detailView);
  // The base maps grid covers the editor: no pre-draw toolbar (and none of
  // its captured tool letters) over the table.
  const dessinGridOpen = useSelector(selectBaseMapsGridDessinOpen);

  const annotationTemplates = useAnnotationTemplates();

  // helpers

  const show =
    isDessinModule &&
    leftPanelDocked &&
    !dessinGridOpen &&
    !enabledDrawingMode &&
    !pasteClipboard &&
    // Both template-level subviews: properties (the landing view on row
    // click) and the annotations list — the plain-letter draw hotkeys are
    // suppressed whenever detailTemplateId is set, so the toolbar must own
    // them on both.
    (detailView === "ANNOTATIONS" || detailView === "PROPERTIES") &&
    Boolean(detailTemplateId);

  const template = show
    ? (annotationTemplates ?? []).find((t) => t.id === detailTemplateId)
    : null;

  // render

  if (!template) return null;

  return <ToolbarContent template={template} />;
}
