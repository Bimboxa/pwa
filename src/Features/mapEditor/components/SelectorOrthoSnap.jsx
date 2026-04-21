import { useState, useEffect, useRef } from "react";
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
  Typography,
  IconButton,
  Popover,
  TextField,
  Divider,
} from "@mui/material";
import {
  Add,
  Remove,
  ArrowDropDown,
  Save as SaveIcon,
  Close as CloseIcon,
  RestartAlt,
} from "@mui/icons-material";

import IconOrthoSnap from "Features/icons/IconOrthoSnap";

import {
  loadOrthoSnapAngles,
  saveOrthoSnapAngle,
  deleteOrthoSnapAngle,
} from "Features/mapEditor/services/orthoSnapAnglesLocalStorage";

export default function SelectorOrthoSnap() {
  const dispatch = useDispatch();
  const orthoSnapEnabled = useSelector((s) => s.mapEditor.orthoSnapEnabled);
  const orthoSnapAngleOffset = useSelector(
    (s) => s.mapEditor.orthoSnapAngleOffset
  );
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // state

  const dropdownAnchorRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState(String(orthoSnapAngleOffset));
  const [savedAngles, setSavedAngles] = useState([]);

  useEffect(() => {
    if (menuOpen) {
      setInputValue(String(orthoSnapAngleOffset));
    }
  }, [menuOpen, orthoSnapAngleOffset]);

  // handlers

  function handleToggle() {
    dispatch(setOrthoSnapEnabled(!orthoSnapEnabled));
  }

  function handleIncrement(delta) {
    const next = Math.round((orthoSnapAngleOffset + delta) * 10) / 10;
    dispatch(setOrthoSnapAngleOffset(next));
  }

  function handleOpenMenu() {
    setSavedAngles(loadOrthoSnapAngles(baseMapId));
    setInputValue(String(orthoSnapAngleOffset));
    setMenuOpen(true);
  }

  function handleCloseMenu() {
    setMenuOpen(false);
  }

  function clampAngle(value) {
    const clamped = Math.max(-90, Math.min(90, value));
    return Math.round(clamped * 10) / 10;
  }

  function commitInputValue() {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const next = clampAngle(parsed);
      dispatch(setOrthoSnapAngleOffset(next));
      setInputValue(String(next));
      return next;
    }
    setInputValue(String(orthoSnapAngleOffset));
    return null;
  }

  function handleInputKeyDown(e) {
    if (e.key === "Enter") {
      commitInputValue();
      e.target.blur();
    }
  }

  function handleSave() {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) return;
    const next = clampAngle(parsed);
    dispatch(setOrthoSnapAngleOffset(next));
    saveOrthoSnapAngle(baseMapId, next);
    setMenuOpen(false);
  }

  function handleReset() {
    dispatch(setOrthoSnapAngleOffset(0));
    setMenuOpen(false);
  }

  function handleSelectSavedAngle(value) {
    dispatch(setOrthoSnapAngleOffset(value));
    setMenuOpen(false);
  }

  function handleDeleteSavedAngle(e, value) {
    e.stopPropagation();
    const next = deleteOrthoSnapAngle(baseMapId, value);
    setSavedAngles(next);
  }

  // render

  const canSave = Boolean(baseMapId) && !isNaN(parseFloat(inputValue));

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
            gap: 0.5,
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
                <IconOrthoSnap
                  sx={{
                    transition: "transform 0.2s ease",
                    transform: `rotate(${-orthoSnapAngleOffset}deg)`,
                  }}
                />
              </ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <IconButton
              size="small"
              onClick={() => handleIncrement(1)}
              sx={{ p: 0.25, borderRadius: 0.5 }}
            >
              <Add sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleIncrement(-1)}
              sx={{ p: 0.25, borderRadius: 0.5 }}
            >
              <Remove sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>

          <Typography
            sx={{
              minWidth: 36,
              textAlign: "right",
              fontSize: 14,
              lineHeight: 1,
              px: 0.5,
              color: "text.primary",
            }}
          >
            {orthoSnapAngleOffset}°
          </Typography>

          <IconButton
            ref={dropdownAnchorRef}
            size="small"
            onClick={handleOpenMenu}
            sx={{ p: 0.25 }}
          >
            <ArrowDropDown sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Paper>

      <Popover
        open={menuOpen}
        anchorEl={dropdownAnchorRef.current}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 180 } } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            py: 0.75,
          }}
        >
          <TextField
            size="small"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={commitInputValue}
            autoFocus
            inputMode="decimal"
            slotProps={{
              input: {
                endAdornment: (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    °
                  </Typography>
                ),
                sx: { fontSize: 14 },
              },
              htmlInput: {
                style: { textAlign: "right", padding: "4px 6px" },
              },
            }}
            sx={{ width: 72 }}
          />
          <Box sx={{ flex: 1 }} />
          <Tooltip
            title={baseMapId ? "Save angle for this map" : "No map selected"}
          >
            <span>
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={!canSave}
                sx={{ p: 0.5 }}
              >
                <SaveIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reset to 0°">
            <IconButton size="small" onClick={handleReset} sx={{ p: 0.5 }}>
              <RestartAlt sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {savedAngles.length > 0 && <Divider />}

        {savedAngles.map((value) => (
          <Box
            key={value}
            onClick={() => handleSelectSavedAngle(value)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1,
              py: 0.5,
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Typography sx={{ fontSize: 14 }}>{value}°</Typography>
            <IconButton
              size="small"
              onClick={(e) => handleDeleteSavedAngle(e, value)}
              sx={{ p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
      </Popover>
    </>
  );
}
