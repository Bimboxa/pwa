import { useState } from "react";

import {
  Box,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import Check from "@mui/icons-material/Check";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import useImagesDisplaySettings from "../hooks/useImagesDisplaySettings";

// ---------------------------------------------------------------------------
// IconButtonImagesSettingsMenu — "…" button of the PopperImages header: a
// menu with the display settings of the photos. Today: the link between an
// ex-situ tile and its anchor on the base map — "Ligne" (leader) or
// "Numéro" (same badge on the tile and on the anchor).
// ---------------------------------------------------------------------------

export default function IconButtonImagesSettingsMenu() {
  // strings

  const moreS = "Options d'affichage";
  const linkS = "Lien image ↔ fond de plan";
  const lineS = "Ligne";
  const numberS = "Numéro";
  const exSituOnlyS = "(mode Ex situ)";

  // data

  const { linkStyle, setLinkStyle } = useImagesDisplaySettings();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const options = [
    { value: "LINE", label: lineS },
    { value: "NUMBER", label: numberS },
  ];

  // handlers

  function handleSelect(value) {
    setLinkStyle(value);
    setAnchorEl(null);
  }

  // render

  return (
    <>
      <Tooltip title={moreS} arrow placement="bottom">
        <Box
          component="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            p: 0,
            border: "none",
            borderRadius: 1.5,
            flexShrink: 0,
            cursor: "pointer",
            color: "text.secondary",
            bgcolor: "action.hover",
            "&:hover": { bgcolor: "action.selected" },
          }}
        >
          <MoreHoriz sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onMouseDown={(e) => e.stopPropagation()}
        slotProps={{ list: { dense: true } }}
      >
        <ListSubheader sx={{ lineHeight: "28px", fontSize: "0.7rem" }}>
          {linkS} {exSituOnlyS}
        </ListSubheader>
        {options.map(({ value, label }) => {
          const checked = value === linkStyle;
          return (
            <MenuItem
              key={value}
              selected={checked}
              onClick={() => handleSelect(value)}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {checked && <Check fontSize="small" />}
              </ListItemIcon>
              <ListItemText primary={label} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
