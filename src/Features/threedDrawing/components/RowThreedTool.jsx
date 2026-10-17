import { useState } from "react";
import { useDispatch } from "react-redux";

import {
  setMoveBaseMapModeActive,
  setRotateBaseMapModeActive,
} from "Features/threedEditor/threedEditorSlice";

import { Box, ListItemButton, Typography } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

const ACTION_BY_THREED_TOOL = {
  MOVE_BASE_MAP: setMoveBaseMapModeActive,
  ROTATE_BASE_MAP: setRotateBaseMapModeActive,
};

// ---------------------------------------------------------------------------
// RowThreedTool — row of a threedEditor base map placement tool of the
// BaseMaps module's "Outils" section (SectionBaseMapsTools: MOVE_BASE_MAP /
// ROTATE_BASE_MAP, 3D editor). Click arms the mode. `variant`: "popper"
// (PopperMapListings row look) or "panel" (docked panel row look). The
// annotation tools of the Dessin module (Extruder / Déplacer / Tourner /
// Isoler une face / Fusionner des faces) are commands of the unified
// commands toolbar (Features/commandsToolbar).
// ---------------------------------------------------------------------------

export default function RowThreedTool({
  threedTool,
  label,
  Icon,
  shortcut,
  variant = "popper",
}) {
  const dispatch = useDispatch();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const isPanel = variant === "panel";

  // handlers

  function handleClick() {
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
