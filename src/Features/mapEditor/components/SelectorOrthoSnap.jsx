import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setOrthoSnapEnabled,
  setOrthoSnapAngleOffset,
} from "Features/mapEditor/mapEditorSlice";

import {
  Paper,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  IconButton,
  Popover,
  InputBase,
  Typography,
} from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";

import IconOrthoSnap from "Features/icons/IconOrthoSnap";

export default function SelectorOrthoSnap() {
  const dispatch = useDispatch();
  const orthoSnapEnabled = useSelector((s) => s.mapEditor.orthoSnapEnabled);
  const orthoSnapAngleOffset = useSelector(
    (s) => s.mapEditor.orthoSnapAngleOffset
  );

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [inputValue, setInputValue] = useState(String(orthoSnapAngleOffset));

  // handlers

  function handleToggle() {
    dispatch(setOrthoSnapEnabled(!orthoSnapEnabled));
  }

  function handleOpenMenu(e) {
    setInputValue(String(orthoSnapAngleOffset));
    setAnchorEl(e.currentTarget);
  }

  function handleCloseMenu() {
    commitValue();
    setAnchorEl(null);
  }

  function commitValue() {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      dispatch(setOrthoSnapAngleOffset(parsed % 360));
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      commitValue();
      setAnchorEl(null);
    }
  }

  // render

  return (
    <Paper
      sx={{
        borderRadius: "8px",
        transition: "all 0.2s ease",
        bgcolor: "background.paper",
        border: "none",
        display: "inline-flex",
        overflow: "hidden",
        ...(!orthoSnapEnabled && {
          "&:hover": {
            elevation: 6,
            transform: "translateY(-2px)",
          },
        }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          "& .MuiSvgIcon-root": {
            color: orthoSnapEnabled ? "primary.main" : "text.secondary",
          },
        }}
      >
        <Tooltip title="Ortho snap 0/45/90° (Shift+O)">
          <ToggleButtonGroup
            value={orthoSnapEnabled ? "ORTHO" : null}
            exclusive
            onChange={handleToggle}
          >
            <ToggleButton value="ORTHO" size="small">
              <IconOrthoSnap />
            </ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>

        <Tooltip title={`Offset: ${orthoSnapAngleOffset}°`}>
          <IconButton size="small" onClick={handleOpenMenu} sx={{ ml: -0.5 }}>
            <ArrowDropDown
              sx={{
                fontSize: 18,
                color: orthoSnapEnabled ? "primary.main" : "text.secondary",
              }}
            />
          </IconButton>
        </Tooltip>
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
            Offset
          </Typography>
          <InputBase
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitValue}
            autoFocus
            type="number"
            inputProps={{ step: 5, min: 0, max: 359 }}
            endAdornment={
              <Typography variant="caption" sx={{ color: "text.secondary", mr: 0.5 }}>
                °
              </Typography>
            }
            sx={{
              width: 70,
              fontSize: 13,
              px: 1,
              py: 0.25,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              "& input": { textAlign: "right", p: 0 },
            }}
          />
        </Box>
      </Popover>
    </Paper>
  );
}
