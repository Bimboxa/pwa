import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setOrthoSnapAngleOffset } from "Features/mapEditor/mapEditorSlice";

import {
  Paper,
  Box,
  Tooltip,
  Typography,
  IconButton,
  Popover,
  TextField,
  Divider,
} from "@mui/material";
import {
  ArrowDropDown,
  Save as SaveIcon,
  Close as CloseIcon,
  RestartAlt,
} from "@mui/icons-material";

import {
  loadOrthoSnapAngles,
  saveOrthoSnapAngle,
  deleteOrthoSnapAngle,
} from "Features/mapEditor/services/orthoSnapAnglesLocalStorage";

export default function SelectorOrthoSnap() {
  const dispatch = useDispatch();
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
      {/* width 40 = ButtonEditScaleVariantFirst (medium IconButton with the
          theme's 16px medium icon + p:0.5 box) so the control never exceeds
          the scale button below it. */}
      <Paper
        sx={{
          borderRadius: "8px",
          transition: "all 0.2s ease",
          bgcolor: "background.paper",
          border: "none",
          display: "inline-flex",
          overflow: "hidden",
          width: 40,
          "&:hover": {
            elevation: 6,
            transform: "translateY(-2px)",
          },
        }}
      >
        <Tooltip title="Ortho reference angle">
          <Box
            ref={dropdownAnchorRef}
            onClick={handleOpenMenu}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 1,
              p: 0.25,
              minHeight: 32,
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
              "& .MuiSvgIcon-root": {
                color: "text.secondary",
              },
            }}
          >
            <Typography
              noWrap
              sx={{
                fontSize: 11,
                lineHeight: 1,
                minWidth: 0,
                color: "text.primary",
              }}
            >
              {orthoSnapAngleOffset}°
            </Typography>

            <ArrowDropDown sx={{ fontSize: 14, flexShrink: 0 }} />
          </Box>
        </Tooltip>
      </Paper>

      <Popover
        open={menuOpen}
        anchorEl={dropdownAnchorRef.current}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { mb: 0.5, minWidth: 180 } } }}
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
