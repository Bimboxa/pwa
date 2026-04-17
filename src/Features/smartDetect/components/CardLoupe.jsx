import { useDispatch, useSelector } from "react-redux";

import { setLoupeAspect } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Paper,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import SmartDetectContainer from "./SmartDetectContainer";
import ShortcutBadge from "./ShortcutBadge";


// Fixed cell width so narrow aspect icons don't yield narrower buttons.
const TOGGLE_CELL = { width: 36, height: 28, p: 0 };

// Visual hints for the aspect options.
function AspectIcon({ aspect }) {
  const dims =
    aspect === "SQUARE"
      ? { width: 12, height: 12 }
      : aspect === "LANDSCAPE"
      ? { width: 16, height: 6 }
      : { width: 6, height: 16 };
  return (
    <Box
      sx={{
        ...dims,
        bgcolor: "action.disabled",
        borderRadius: "1px",
      }}
    />
  );
}

export default function CardLoupe() {
  // data

  const dispatch = useDispatch();
  const loupeAspect = useSelector((s) => s.mapEditor.loupeAspect);

  // handlers

  const handleAspectChange = (_e, next) => {
    if (!next) return;
    dispatch(setLoupeAspect(next));
  };

  // render

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      {/* Header: "LOUPE" title + (optional) format toggles + F shortcut */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            color: "text.secondary",
            letterSpacing: 0.5,
            flex: 1,
          }}
        >
          Loupe
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={loupeAspect}
          exclusive
          onChange={handleAspectChange}
          aria-label="Loupe format"
        >
          <Tooltip title="Carré">
            <ToggleButton value="SQUARE" sx={TOGGLE_CELL}>
              <AspectIcon aspect="SQUARE" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Paysage">
            <ToggleButton value="LANDSCAPE" sx={TOGGLE_CELL}>
              <AspectIcon aspect="LANDSCAPE" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Portrait">
            <ToggleButton value="PORTRAIT" sx={TOGGLE_CELL}>
              <AspectIcon aspect="PORTRAIT" />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
        <ShortcutBadge>F</ShortcutBadge>
      </Box>

      {/* Loupe preview — fixed-size square so Portrait / Landscape are centered */}
      <Box sx={{ mt: 1.5 }}>
        <SmartDetectContainer />
      </Box>

      {/* Size one-liner — shortcuts only */}
      <Box
        sx={{
          mt: 1,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        <Typography variant="body2" sx={{ flex: 1 }}>
          Taille
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          +
        </Typography>
        <ShortcutBadge>P</ShortcutBadge>
        <Typography variant="body2" sx={{ fontWeight: 600, ml: 0.5 }}>
          −
        </Typography>
        <ShortcutBadge>M</ShortcutBadge>
      </Box>
    </Paper>
  );
}
