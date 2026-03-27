import { useState, useEffect } from "react";
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
  InputBase,
  Typography,
} from "@mui/material";

import IconOrthoSnap from "Features/icons/IconOrthoSnap";

export default function SelectorOrthoSnap() {
  const dispatch = useDispatch();
  const orthoSnapEnabled = useSelector((s) => s.mapEditor.orthoSnapEnabled);
  const orthoSnapAngleOffset = useSelector(
    (s) => s.mapEditor.orthoSnapAngleOffset
  );

  // state

  const [inputValue, setInputValue] = useState(String(orthoSnapAngleOffset));

  useEffect(() => {
    setInputValue(String(orthoSnapAngleOffset));
  }, [orthoSnapAngleOffset]);

  // handlers

  function handleToggle() {
    dispatch(setOrthoSnapEnabled(!orthoSnapEnabled));
  }

  function commitValue() {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      dispatch(setOrthoSnapAngleOffset(parsed));
    } else {
      setInputValue(String(orthoSnapAngleOffset));
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      commitValue();
      e.target.blur();
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
              <IconOrthoSnap
                sx={{
                  transition: "transform 0.2s ease",
                  transform: `rotate(${-orthoSnapAngleOffset}deg)`,
                }}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>

        <InputBase
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          endAdornment={
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", mr: 0.5, lineHeight: 1 }}
            >
              °
            </Typography>
          }
          sx={{
            width: 48,
            fontSize: 12,
            ml: 0.25,
            px: 0.5,
            py: 0.25,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            "& input": { textAlign: "right", p: 0 },
          }}
        />
      </Box>
    </Paper>
  );
}
