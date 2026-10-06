import { useDispatch, useSelector } from "react-redux";

import { setToolsSectionCollapsed } from "Features/panelDrawing/panelDrawingSlice";

import { Box, List, Typography } from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";

import RowPanelDrawingTool from "./RowPanelDrawingTool";
import RowTemplatelessDraw from "Features/mapEditor/components/RowTemplatelessDraw";
import RowThreedTool from "Features/threedDrawing/components/RowThreedTool";
import RowRevolutionAxisTool from "Features/revolutionAxes/components/RowRevolutionAxisTool";
import { getToolItemsForEditor } from "Features/mapEditor/constants/toolItems";

// ---------------------------------------------------------------------------
// SectionPanelDrawingTools — collapsible "OUTILS DE DESSIN" section listing
// the shortcut tools (Dessin D, Ouverture O, Retirer un segment X, Couper un
// segment C, Joindre J, Axe de révolution A — RowRevolutionAxisTool —,
// Déplacer M, Tourner R). In the 3D editor
// (`isThreedEditor`): the "Dessin" row, the "Axe de révolution" row (drawn on
// a horizontal base map plane) and the 3D tools only (Coupe face C, and the
// threedEditor tools Extruder E / Déplacer M / Tourner R — RowThreedTool) —
// the others are 2D drawing modes.
// ---------------------------------------------------------------------------

export default function SectionPanelDrawingTools({
  templatelessCount,
  isThreedEditor = false,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Outils de dessin";

  // data

  const collapsed = useSelector((s) => s.panelDrawing.toolsSectionCollapsed);

  // helpers

  const tools = getToolItemsForEditor({ isThreedEditor }).filter(
    (t) =>
      (t.shortcut || t.isRevolutionAxis) &&
      (!isThreedEditor ||
        t.isTemplatelessDraw ||
        t.isRevolutionAxis ||
        t.editor ||
        t.threedTool)
  );

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
            ) : tool.isRevolutionAxis ? (
              <RowRevolutionAxisTool
                key={tool.type}
                label={tool.label}
                Icon={tool.Icon}
                shortcut={tool.shortcut}
                variant="panel"
                isThreedEditor={isThreedEditor}
              />
            ) : isThreedEditor && tool.threedTool ? (
              <RowThreedTool
                key={tool.type}
                threedTool={tool.threedTool}
                label={tool.label}
                Icon={tool.Icon}
                shortcut={tool.shortcut}
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
