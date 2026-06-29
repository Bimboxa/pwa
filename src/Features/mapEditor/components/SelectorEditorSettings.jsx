import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setVertexSizeMultiplier } from "Features/mapEditor/mapEditorSlice";

import { saveVertexSizeMultiplier } from "Features/mapEditor/services/editorSettingsLocalStorage";

import {
  Paper,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Popover,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";

// Reference (×1) is the current hardcoded vertex size (POINT_SIZE = 6 in
// NodePolylineStatic); the two larger options scale it up. boxSize is only the
// on-screen preview square inside each option button.
const VERTEX_SIZES = [
  { multiplier: 1, boxSize: 6 },
  { multiplier: 1.5, boxSize: 9 },
  { multiplier: 2, boxSize: 12 },
];

// Bottom toolbar toggle (left of the clipping-plane toggle). Opens a settings
// popover for the 2D editor. First option: vertex handle size used by
// NodePolylineStatic.
export default function SelectorEditorSettings() {
  // data

  const dispatch = useDispatch();
  const vertexSizeMultiplier = useSelector(
    (s) => s.mapEditor.vertexSizeMultiplier
  );

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

  function handleSelectVertexSize(multiplier) {
    dispatch(setVertexSizeMultiplier(multiplier));
    saveVertexSizeMultiplier(multiplier);
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
        <Box sx={{ px: 2, py: 1.5, minWidth: 240 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Paramétrage de l'éditeur 2D
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.25,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Taille vertex
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              {VERTEX_SIZES.map(({ multiplier, boxSize }) => {
                const isSelected = vertexSizeMultiplier === multiplier;
                return (
                  <Tooltip key={multiplier} title={`×${multiplier}`}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleSelectVertexSize(multiplier)}
                      >
                        <Box
                          sx={{
                            width: boxSize,
                            height: boxSize,
                            border: "2px solid",
                            borderColor: isSelected
                              ? "primary.main"
                              : "text.secondary",
                            bgcolor: isSelected ? "primary.main" : "transparent",
                            borderRadius: 0.5,
                          }}
                        />
                      </IconButton>
                    </span>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
