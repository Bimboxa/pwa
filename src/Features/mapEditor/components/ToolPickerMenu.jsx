import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";

import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolsByShape } from "Features/mapEditor/constants/drawingTools.jsx";
import { getHotkeyForToolInGroup } from "Features/mapEditor/constants/drawingToolHotkeys";

// ---------------------------------------------------------------------------
// ToolPickerMenu — menu to select a drawing tool for an annotation template
// ---------------------------------------------------------------------------

export default function ToolPickerMenu({
  anchorEl,
  open,
  onClose,
  annotationTemplate,
  onSelectTool,
  onEdit,
}) {
  // helpers

  const drawingShape = resolveDrawingShape(annotationTemplate);
  const tools = getDrawingToolsByShape(drawingShape);

  // render

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      // The menu is portaled to the body but stays a React child of the row /
      // split button that opened it: without stopping propagation, clicking an
      // item (or the backdrop) would bubble up the REACT tree to the row's
      // onClick — e.g. navigating the Dessin panel to the template detail view.
      onClick={(e) => e.stopPropagation()}
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
      {/* Template name header */}
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
          sx={{
            fontWeight: 600,
            color: "panel.textPrimary",
          }}
        >
          {annotationTemplate?.label}
        </Typography>
      </Box>

      {/* Tool options */}
      {tools.map((tool) => {
        const hotkey = getHotkeyForToolInGroup(tool, tools);
        return (
          <MenuItem
            key={tool.key}
            onClick={() => {
              onSelectTool(tool);
              onClose();
            }}
            sx={{ gap: 1, py: 0.75, fontSize: "0.8125rem" }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <tool.Icon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {tool.label}
            </ListItemText>
            {hotkey && (
              <Box
                sx={{
                  ml: "auto",
                  minWidth: 16,
                  height: 16,
                  px: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 0.5,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "text.secondary",
                  lineHeight: 1,
                }}
              >
                {hotkey}
              </Box>
            )}
          </MenuItem>
        );
      })}

      <Divider />

      {/* Edit template button */}
      <MenuItem
        onClick={() => {
          onEdit();
          onClose();
        }}
        sx={{ gap: 1, py: 0.75, color: "panel.textMuted" }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          <SettingsOutlined sx={{ fontSize: 18, color: "panel.textMuted" }} />
        </ListItemIcon>
        <ListItemText
          primaryTypographyProps={{
            variant: "body2",
            color: "panel.textMuted",
          }}
        >
          Éditer le modèle
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}
