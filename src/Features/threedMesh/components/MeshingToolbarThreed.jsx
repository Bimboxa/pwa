import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setMeshingModeActive,
  setMeshingOffset,
  setMeshingShootActive,
  setMeshingTool,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NearMeIcon from "@mui/icons-material/NearMe";
import SanitizerIcon from "@mui/icons-material/Sanitizer";

// Tool glyphs match the mockup: plain strokes for the three cut lines.
const TOOLS = [
  {
    value: "SELECT",
    label: "Sélection — clic sur une face pour créer une maille",
    render: () => <NearMeIcon sx={{ fontSize: 18 }} />,
  },
  {
    value: "CUT_VERTICAL",
    label: "Trait de coupe vertical (S : changer de côté)",
    render: () => <Glyph>│</Glyph>,
  },
  {
    value: "CUT_HORIZONTAL",
    label: "Trait de coupe horizontal (S : changer de côté)",
    render: () => <Glyph>—</Glyph>,
  },
  {
    value: "CUT_FREE",
    label: "Trait de coupe libre — 2 clics sur les bords d'une maille",
    render: () => <Glyph>╱</Glyph>,
  },
];

function Glyph({ children }) {
  return (
    <Box
      component="span"
      sx={{ fontSize: 16, lineHeight: 1, width: 18, textAlign: "center" }}
    >
      {children}
    </Box>
  );
}

// Specialized bottom toolbar shown while meshing mode is active. Replaces
// BottomToolbarThreed (same swap pattern as ClippingToolbarThreed).
export default function MeshingToolbarThreed() {
  const dispatch = useDispatch();

  const tool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const offset = useSelector((s) => s.threedEditor.meshingMode.offset);
  const shootActive = useSelector(
    (s) => s.threedEditor.meshingMode.shootActive
  );

  // Local text state so the user can type freely ("2.", "2,5", "").
  const [offsetText, setOffsetText] = useState(String(offset));
  useEffect(() => {
    setOffsetText(String(offset));
  }, [offset]);

  // handlers

  function handleTool(_e, value) {
    if (!value) return; // ignore toggling the active tool off
    dispatch(setMeshingTool(value));
  }

  function handleOffsetChange(e) {
    const text = e.target.value;
    setOffsetText(text);
    const value = parseFloat(text.replace(",", "."));
    if (Number.isFinite(value) && value >= 0) {
      dispatch(setMeshingOffset(value));
    }
  }

  function handleClose() {
    dispatch(setMeshingModeActive(false));
  }

  // render

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1,
        py: 0.5,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography sx={{ fontSize: 13, fontWeight: 500, px: 0.5 }}>
          Mailler
        </Typography>

        <ToggleButtonGroup
          exclusive
          value={tool}
          onChange={handleTool}
          disabled={shootActive}
        >
          {TOOLS.map(({ value, label, render }) => (
            <Tooltip key={value} title={label}>
              <ToggleButton value={value} size="small">
                {render()}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <TextField
          value={offsetText}
          onChange={handleOffsetChange}
          label="Décalage"
          size="small"
          sx={{ width: 110 }}
          slotProps={{
            input: {
              endAdornment: <InputAdornment position="end">m</InputAdornment>,
            },
          }}
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Shoot — lance à béton : clic dans la vue pour projeter">
          <ToggleButton
            value="SHOOT"
            size="small"
            selected={shootActive}
            onChange={() => dispatch(setMeshingShootActive(!shootActive))}
          >
            <SanitizerIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Quitter le mode maillage">
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
