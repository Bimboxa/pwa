import { useState } from "react";

import {
  Box,
  Typography,
  ListItemButton,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import useDrawToolOfType from "Features/mapEditor/hooks/useDrawToolOfType";

// ---------------------------------------------------------------------------
// RowPopperTool — one tool row of the "Commandes" sections of the poppers
// (SectionPopperDrawingTools): click-to-draw + tool picker menu.
// ---------------------------------------------------------------------------

export default function RowPopperTool({ type, label, Icon, shortcut }) {
  const { tools, activeTool, startDraw, selectToolAndDraw } =
    useDrawToolOfType(type);

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [toolMenuAnchor, setToolMenuAnchor] = useState(null);

  // helpers

  const ActiveToolIcon = activeTool?.Icon;

  // handlers

  const handleRowClick = () => {
    startDraw();
  };

  const handleToolBtnClick = (e) => {
    e.stopPropagation();
    setToolMenuAnchor(e.currentTarget);
  };

  const handleSelectTool = (tool) => {
    selectToolAndDraw(tool);
  };

  const handleMenuClose = () => {
    setToolMenuAnchor(null);
    setIsHovered(false);
  };

  // render

  return (
    <Box>
      <ListItemButton
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!toolMenuAnchor) setIsHovered(false);
        }}
        sx={{
          position: "relative",
          bgcolor: "white",
          alignItems: "center",
          justifyContent: "space-between",
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
            flex: 1,
            minWidth: 0,
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
        </Box>

        {/* Right side: active tool icon on hover (only when there is a choice) */}
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
                "&:hover": {
                  bgcolor: "panel.textMuted",
                  color: "white",
                },
              }}
            >
              <ActiveToolIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </ListItemButton>

      {/* Tool picker menu */}
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
              handleSelectTool(tool);
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
