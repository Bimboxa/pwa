import { useDispatch, useSelector } from "react-redux";

import { setToolsSectionCollapsed } from "Features/panelDrawing/panelDrawingSlice";

import { Box, List, Typography } from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";

import RowPanelDrawingTool from "./RowPanelDrawingTool";
import RowTemplatelessDraw from "Features/mapEditor/components/RowTemplatelessDraw";
import TOOL_ITEMS from "Features/mapEditor/constants/toolItems";

// ---------------------------------------------------------------------------
// SectionPanelDrawingTools — collapsible "OUTILS DE DESSIN" section listing
// the shortcut tools (Dessin D, Ouverture O, Retirer un segment X, Couper un
// segment C). `templatelessOnly` (3D editor) keeps the "Dessin" row alone —
// the other tools are 2D drawing modes.
// ---------------------------------------------------------------------------

const SHORTCUT_TOOLS = TOOL_ITEMS.filter((t) => t.shortcut);

export default function SectionPanelDrawingTools({
  templatelessCount,
  templatelessOnly = false,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Outils de dessin";

  // data

  const collapsed = useSelector((s) => s.panelDrawing.toolsSectionCollapsed);

  // helpers

  const tools = templatelessOnly
    ? SHORTCUT_TOOLS.filter((t) => t.isTemplatelessDraw)
    : SHORTCUT_TOOLS;

  // render

  return (
    <Box>
      <Box
        onClick={() => dispatch(setToolsSectionCollapsed(!collapsed))}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          cursor: "pointer",
          bgcolor: "panel.sectionBg",
          borderTop: "1px solid",
          borderBottom: collapsed ? "none" : "1px solid",
          borderColor: "panel.border",
          userSelect: "none",
          "&:hover": { bgcolor: "panel.border" },
        }}
      >
        {collapsed ? (
          <ChevronRight sx={{ fontSize: 18, color: "panel.textLight" }} />
        ) : (
          <ExpandMore sx={{ fontSize: 18, color: "panel.textLight" }} />
        )}
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            color: "panel.textMuted",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: "11px",
          }}
        >
          {titleS}
        </Typography>
      </Box>

      {!collapsed && (
        <List dense disablePadding>
          {tools.map((tool) =>
            tool.isTemplatelessDraw ? (
              <RowTemplatelessDraw
                key={tool.type}
                label={tool.label}
                Icon={tool.Icon}
                shortcut={tool.shortcut}
                count={templatelessCount}
                variant="panel"
              />
            ) : (
              <RowPanelDrawingTool
                key={tool.type}
                type={tool.type}
                label={tool.label}
                Icon={tool.Icon}
                shortcut={tool.shortcut}
              />
            )
          )}
        </List>
      )}
    </Box>
  );
}
