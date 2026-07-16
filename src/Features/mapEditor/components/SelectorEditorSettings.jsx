import { useState } from "react";

import {
  Paper,
  Box,
  Tooltip,
  Popover,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";

import SectionEditorSettings2d from "./SectionEditorSettings2d";

// Bottom toolbar toggle (left of the clipping-plane toggle). Opens the 2D
// editor settings popover (content shared with the right-panel SETTINGS tool,
// see SectionEditorSettings2d).
export default function SelectorEditorSettings() {
  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const open = Boolean(anchorEl);

  // handlers

  function handleToggle(e) {
    setAnchorEl(anchorEl ? null : e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  // render

  return (
    <>
      <Paper
        sx={{
          borderRadius: "8px",
          transition: "all 0.2s ease",
          bgcolor: "background.paper",
          border: "none",
          display: "inline-flex",
          overflow: "hidden",
          ...(!open && {
            "&:hover": { elevation: 6, transform: "translateY(-2px)" },
          }),
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: 0.5,
            "& .MuiSvgIcon-root": {
              color: open ? "primary.main" : "text.secondary",
            },
          }}
        >
          <Tooltip title="Paramétrage de l'éditeur 2D">
            <ToggleButtonGroup
              value={open ? "SETTINGS" : null}
              exclusive
              onChange={handleToggle}
            >
              <ToggleButton value="SETTINGS" size="small">
                <SettingsIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
        </Box>
      </Paper>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <SectionEditorSettings2d />
      </Popover>
    </>
  );
}
