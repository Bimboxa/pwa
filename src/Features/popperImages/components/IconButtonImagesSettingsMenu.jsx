import { useState } from "react";

import {
  Box,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
} from "@mui/material";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import useImagesDisplaySettings from "../hooks/useImagesDisplaySettings";

// ---------------------------------------------------------------------------
// IconButtonImagesSettingsMenu — "…" button of the PopperImages header: a
// menu with the display settings of the photos. Today: the links between an
// ex-situ tile and its anchor on the base map — "Ligne" (leader) and
// "Numéro" (same badge on the tile and on the anchor), two independent
// switches (both on, one, or none).
// ---------------------------------------------------------------------------

export default function IconButtonImagesSettingsMenu() {
  // strings

  const moreS = "Options d'affichage";
  const linkS = "Lien image ↔ fond de plan";
  const lineS = "Ligne";
  const numberS = "Numéro";

  // data

  const { linkLine, linkNumber, setLinkLine, setLinkNumber } =
    useImagesDisplaySettings();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const options = [
    { key: "LINE", label: lineS, checked: linkLine, onToggle: setLinkLine },
    {
      key: "NUMBER",
      label: numberS,
      checked: linkNumber,
      onToggle: setLinkNumber,
    },
  ];

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
          {linkS}
        </ListSubheader>
        {options.map(({ key, label, checked, onToggle }) => (
          <MenuItem
            key={key}
            onClick={() => onToggle(!checked)}
            sx={{ gap: 1.5, pr: 1 }}
          >
            <ListItemText primary={label} />
            <Switch
              size="small"
              edge="end"
              checked={checked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onToggle(e.target.checked)}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
