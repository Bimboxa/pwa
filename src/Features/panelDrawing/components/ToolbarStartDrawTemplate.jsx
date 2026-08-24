import { useSelector } from "react-redux";

import { Paper, Box, Typography } from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useDrawFromTemplate from "Features/mapEditor/hooks/useDrawFromTemplate";
import { getHotkeyForToolInGroup } from "Features/mapEditor/constants/drawingToolHotkeys";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// ToolbarStartDrawTemplate — floating toolbar above the bottom bar while the
// Dessin panel shows a template's annotations list (2D editor, no drawing
// mode armed): pick one of the template's drawing tools to start a new
// annotation right away. Once a draw is armed, ToolbarDrawingDraft takes
// over (this one returns null).
// ---------------------------------------------------------------------------

function ToolbarContent({ template }) {
  // strings

  const drawS = "Dessiner";

  // data

  const { tools, selectToolAndDraw } = useDrawFromTemplate(
    template,
    template.listingId
  );

  // helpers

  const templateColor = template?.fillColor ?? template?.strokeColor ?? "#999";

  const options = tools.map((tool) => {
    const { key, label, Icon } = tool;
    const hotkey = getHotkeyForToolInGroup(tool, tools);
    return {
      key,
      label,
      icon: (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <Icon sx={{ color: templateColor }} />
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

  function handleToolChange(toolKey) {
    if (!toolKey) return;
    const tool = tools.find((t) => t.key === toolKey);
    if (tool) selectToolAndDraw(tool);
  }

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
        gap: 1,
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
      <ToggleSingleSelectorGeneric
        options={options}
        selectedKey={null}
        onChange={handleToolChange}
      />
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
    detailView === "ANNOTATIONS" &&
    Boolean(detailTemplateId);

  const template = show
    ? (annotationTemplates ?? []).find((t) => t.id === detailTemplateId)
    : null;

  // render

  if (!template) return null;

  return <ToolbarContent template={template} />;
}
