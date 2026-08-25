import { useState } from "react";

import {
  Box,
  Typography,
  ListItemButton,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import useDrawToolOfType from "Features/mapEditor/hooks/useDrawToolOfType";

// ---------------------------------------------------------------------------
// RowPanelDrawingTool — one cut/split tool row of the Dessin panel: click to
// activate, hover button to pick a variant when the tool group has several.
// ---------------------------------------------------------------------------

export default function RowPanelDrawingTool({ type, label, Icon, shortcut }) {
  // data

  const { tools, activeTool, startDraw, selectToolAndDraw } =
    useDrawToolOfType(type);

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [toolMenuAnchor, setToolMenuAnchor] = useState(null);

  // helpers

  const ActiveToolIcon = activeTool?.Icon;

  // handlers

  const handleToolBtnClick = (e) => {
    e.stopPropagation();
    setToolMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setToolMenuAnchor(null);
    setIsHovered(false);
  };

  // render

  return (
    <Box>
      <ListItemButton
        onClick={startDraw}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!toolMenuAnchor) setIsHovered(false);
        }}
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

        {/* Variant picker (only when the tool group has a choice) */}
        {isHovered && ActiveToolIcon && tools.length > 1 && (
          <Tooltip title="Changer d'outil" arrow>
            <IconButton
              size="small"
              onClick={handleToolBtnClick}
              sx={{
                p: 0.5,
                bgcolor: toolMenuAnchor ? "panel.textMuted" : "action.hover",
                color: toolMenuAnchor ? "white" : "panel.textMuted",
                borderRadius: 1,
                "&:hover": { bgcolor: "panel.textMuted", color: "white" },
              }}
            >
              <ActiveToolIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </ListItemButton>

      <Menu
        anchorEl={toolMenuAnchor}
        open={Boolean(toolMenuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "panel.border",
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "panel.textPrimary" }}
          >
            {label}
          </Typography>
        </Box>
        {tools.map((tool) => (
          <MenuItem
            key={tool.key}
            onClick={() => {
              selectToolAndDraw(tool);
              handleMenuClose();
            }}
            sx={{ gap: 1, py: 0.75, fontSize: "0.8125rem" }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <tool.Icon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {tool.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
