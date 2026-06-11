import {
  Box,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { GridOn } from "@mui/icons-material";

// Vertical / horizontal / free line glyphs (no dedicated MUI icon).
function VLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function HLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function FreeLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <line
        x1="3"
        y1="15"
        x2="15"
        y2="3"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

// Instruction text shown in the helper for each line tool.
function lineHelperText(activeTool, freeStartPlaced) {
  if (activeTool === "ADD_VERTICAL")
    return "Cliquez sur le plan pour placer la ligne verticale.";
  if (activeTool === "ADD_HORIZONTAL")
    return "Cliquez sur le plan pour placer la ligne horizontale.";
  if (activeTool === "ADD_FREE")
    return freeStartPlaced
      ? "Cliquez le second point de la ligne."
      : "Cliquez le premier point de la ligne.";
  return "";
}

// Bottom toolbar of the mesh panel. In SELECT mode it shows the cutting tools;
// when a tool is active it swaps to that tool's helper (instruction text for the
// line tools, two width × height fields for the grid). Save / reset live in the
// editor header, not here.
export default function MeshToolbar({
  editing,
  activeTool,
  freeStartPlaced,
  showMeshByEdges,
  gridCell,
  onChangeGridCell,
  onSelectTool,
  onMeshByEdges,
}) {
  if (!editing) return null;

  const isLineTool =
    activeTool === "ADD_VERTICAL" ||
    activeTool === "ADD_HORIZONTAL" ||
    activeTool === "ADD_FREE";
  const isGrid = activeTool === "GRID";
  const isPlacing = isLineTool || isGrid;

  const wrapperSx = {
    p: 1.5,
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
    alignItems: "center",
    borderTop: (theme) => `1px solid ${theme.palette.divider}`,
  };

  // --- helper (a tool is active) ---
  if (isPlacing) {
    return (
      <Box sx={wrapperSx}>
        {isLineTool && (
          <Typography variant="body2" color="text.secondary">
            {lineHelperText(activeTool, freeStartPlaced)}
          </Typography>
        )}

        {isGrid && (
          <>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Largeur (m)"
                type="number"
                size="small"
                value={gridCell?.width ?? ""}
                onChange={(e) =>
                  onChangeGridCell?.({ width: Number(e.target.value) })
                }
                sx={{ width: 110 }}
                inputProps={{ min: 0, step: 0.1 }}
              />
              <TextField
                label="Hauteur (m)"
                type="number"
                size="small"
                value={gridCell?.height ?? ""}
                onChange={(e) =>
                  onChangeGridCell?.({ height: Number(e.target.value) })
                }
                sx={{ width: 110 }}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Cliquez sur le plan pour poser la grille.
            </Typography>
          </>
        )}

        <Button size="small" color="inherit" onClick={() => onSelectTool?.("SELECT")}>
          Terminer
        </Button>
      </Box>
    );
  }

  // --- tool picker (SELECT mode) ---
  return (
    <Box sx={wrapperSx}>
      <ToggleButtonGroup
        value={activeTool}
        exclusive
        size="small"
        onChange={(e, value) => onSelectTool?.(value)}
      >
        <ToggleButton value="ADD_VERTICAL" sx={{ gap: 0.5 }}>
          <VLineIcon />
          Ligne verticale
        </ToggleButton>
        <ToggleButton value="ADD_HORIZONTAL" sx={{ gap: 0.5 }}>
          <HLineIcon />
          Ligne horizontale
        </ToggleButton>
        <ToggleButton value="ADD_FREE" sx={{ gap: 0.5 }}>
          <FreeLineIcon />
          Ligne libre
        </ToggleButton>
        <ToggleButton value="GRID" sx={{ gap: 0.5 }}>
          <GridOn fontSize="small" />
          Grille
        </ToggleButton>
      </ToggleButtonGroup>

      {showMeshByEdges && (
        <Button size="small" color="inherit" onClick={onMeshByEdges}>
          Maillage par arête
        </Button>
      )}
    </Box>
  );
}
