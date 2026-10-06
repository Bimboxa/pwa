import { useState } from "react";
import { useDispatch, useStore } from "react-redux";

import {
  setExtrudeModeActive,
  setRotateAnnotationModeActive,
  setMoveBaseMapModeActive,
  setRotateBaseMapModeActive,
} from "Features/threedEditor/threedEditorSlice";

import { Box, ListItemButton, Typography } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { activateMoveTool } from "Features/threedVertexOffset/utils/resolveVertexOffsetTarget";

// MOVE_ANNOTATION goes through activateMoveTool: a selected face arms the
// vertex offset mode instead of the whole-annotation move.
const ACTION_BY_THREED_TOOL = {
  EXTRUDE: setExtrudeModeActive,
  ROTATE_ANNOTATION: setRotateAnnotationModeActive,
  MOVE_BASE_MAP: setMoveBaseMapModeActive,
  ROTATE_BASE_MAP: setRotateBaseMapModeActive,
};

// ---------------------------------------------------------------------------
// RowThreedTool — « Outils de dessin » row of a threedEditor tool (TOOL_ITEMS
// `threedTool`: Extruder / Déplacer / Tourner) in the Dessin module's 3D
// editor. Click arms the mode; the drawing helper then replaces the list
// (selectActiveThreedTool). Also the rows of the base maps "Outils" section
// (SectionBaseMapsTools: MOVE_BASE_MAP / ROTATE_BASE_MAP). `variant`: "popper" (PopperMapListings' ToolRow
// look) or "panel" (RowPanelDrawingTool look).
// ---------------------------------------------------------------------------

export default function RowThreedTool({
  threedTool,
  label,
  Icon,
  shortcut,
  variant = "popper",
}) {
  const dispatch = useDispatch();
  const store = useStore();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const isPanel = variant === "panel";

  // handlers

  function handleClick() {
    if (threedTool === "MOVE_ANNOTATION") {
      activateMoveTool({
        dispatch,
        state: store.getState(),
        editor: getActiveThreedEditor(),
      });
      return;
    }
    const action = ACTION_BY_THREED_TOOL[threedTool];
    if (action) dispatch(action(true));
  }

  // render

  if (isPanel) {
    return (
      <ListItemButton
        onClick={handleClick}
        sx={{
          bgcolor: "background.paper",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.75,
          "&:not(:last-child)": {
            borderBottom: "1px solid",
            borderColor: "divider",
          },
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 20, color: "primary.main" }} />
        </Box>
        {shortcut && (
          <Box sx={{ flexShrink: 0 }}>
            <ShortcutBadge>{shortcut}</ShortcutBadge>
          </Box>
        )}
        <Typography
          variant="body2"
          sx={{ flex: 1, minWidth: 0, userSelect: "none" }}
          noWrap
        >
          {label}
        </Typography>
      </ListItemButton>
    );
  }

  return (
    <ListItemButton
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: "relative",
        bgcolor: "white",
        alignItems: "center",
        pl: 3,
        pr: 1,
        py: 0.5,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "24px",
          height: "24px",
          mr: 1,
        }}
      >
        <Icon
          sx={{
            fontSize: 18,
            color: isHovered ? "panel.textSecondary" : "panel.textMuted",
          }}
        />
      </Box>
      {shortcut && (
        <Box sx={{ mr: 1, flexShrink: 0 }}>
          <ShortcutBadge>{shortcut}</ShortcutBadge>
        </Box>
      )}
      <Typography
        variant="body2"
        sx={{ color: "panel.textSecondary", userSelect: "none" }}
      >
        {label}
      </Typography>
    </ListItemButton>
  );
}
