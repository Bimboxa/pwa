import { useState } from "react";

import {
  Box,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useStartRevolutionAxisTools from "../hooks/useStartRevolutionAxisTools";

// ---------------------------------------------------------------------------
// RowRevolutionAxisTool — "Axe de révolution" row of the drawing tools
// sections (PopperMapListings + Dessin left panel).
// - HORIZONTAL base map: click draws a new axis (centre, then radius +
//   direction). The axis belongs to the base map + the scope, no listing.
// - VERTICAL base map: an axis cannot be authored there — the row drops an
//   EXISTING axis of the scope instead (one click, which poses the base map in
//   3D): directly when there is a single axis, through a menu otherwise.
// ---------------------------------------------------------------------------

const SX_BY_VARIANT = {
  popper: {
    row: { bgcolor: "white", pl: 3, pr: 1, py: 0.5 },
    iconSize: 18,
    iconColor: "panel.textMuted",
    labelColor: "panel.textSecondary",
  },
  panel: {
    row: {
      bgcolor: "background.paper",
      px: 1.5,
      py: 0.75,
      "&:not(:last-child)": {
        borderBottom: "1px solid",
        borderColor: "divider",
      },
    },
    iconSize: 20,
    iconColor: "primary.main",
    labelColor: "text.primary",
  },
};

export default function RowRevolutionAxisTool({
  label,
  Icon,
  shortcut,
  variant = "popper",
}) {
  // strings

  const drawS = "Dessiner un axe : centre, puis rayon et direction";
  const placeS = "Poser un axe sur ce fond de plan";
  const noAxisS = "Créez d'abord un axe sur un fond de plan horizontal";
  const menuTitleS = "Axe à poser";

  // data

  const baseMap = useMainBaseMap();
  const revolutionAxes = useRevolutionAxes();
  const { startDrawAxis, startPlaceAxis } = useStartRevolutionAxisTools();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  const sx = SX_BY_VARIANT[variant] ?? SX_BY_VARIANT.popper;
  const isVertical = baseMap?.orientation === "VERTICAL";
  const disabled = isVertical && revolutionAxes.length === 0;
  const tooltip = !isVertical ? drawS : disabled ? noAxisS : placeS;

  // handlers

  const handleRowClick = (e) => {
    if (!isVertical) {
      startDrawAxis();
      return;
    }
    if (revolutionAxes.length === 1) startPlaceAxis(revolutionAxes[0]);
    else if (revolutionAxes.length > 1) setMenuAnchor(e.currentTarget);
  };

  const handleSelectAxis = (axis) => {
    setMenuAnchor(null);
    startPlaceAxis(axis);
  };

  // render

  return (
    <Box>
      <Tooltip title={tooltip} arrow placement="right" enterDelay={600}>
        <ListItemButton
          onClick={handleRowClick}
          sx={{
            alignItems: "center",
            gap: 1,
            ...sx.row,
            cursor: disabled ? "default" : "pointer",
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
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Icon sx={{ fontSize: sx.iconSize, color: sx.iconColor }} />
          </Box>
          {/* The hotkey draws an axis: plan base maps only. */}
          {shortcut && !isVertical && (
            <Box sx={{ flexShrink: 0 }}>
              <ShortcutBadge>{shortcut}</ShortcutBadge>
            </Box>
          )}
          <Typography
            variant="body2"
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              userSelect: "none",
              color: disabled ? "text.disabled" : sx.labelColor,
            }}
          >
            {label}
          </Typography>
        </ListItemButton>
      </Tooltip>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
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
            {menuTitleS}
          </Typography>
        </Box>
        {revolutionAxes.map((axis) => (
          <MenuItem key={axis.id} dense onClick={() => handleSelectAxis(axis)}>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {axis.label ?? "Axe"}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
