import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";

import { Save, GridOn } from "@mui/icons-material";

// Vertical / horizontal line glyphs (no dedicated MUI icon).
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

// Bottom toolbar of the mesh panel: enter edit mode, pick a drawing tool, save.
export default function MeshToolbar({
  editing,
  activeTool,
  canSave,
  showMeshByEdges,
  resetLabel = "Réinitialiser le maillage",
  onStartEdit,
  onSave,
  onCancel,
  onSelectTool,
  onMeshByEdges,
  onReset,
}) {
  if (!editing) {
    return (
      <Box sx={{ p: 1.5, display: "flex", justifyContent: "center" }}>
        <Button variant="outlined" onClick={onStartEdit}>
          Éditer le maillage
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        alignItems: "center",
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
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
        <ToggleButton value="GRID_2x2" sx={{ gap: 0.5 }}>
          <GridOn fontSize="small" />
          Grille 2×2
        </ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: "flex", gap: 1 }}>
        {showMeshByEdges && (
          <Button size="small" color="inherit" onClick={onMeshByEdges}>
            Maillage par arête
          </Button>
        )}
        <Button size="small" color="inherit" onClick={onReset}>
          {resetLabel}
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 1 }}>
        <Button color="inherit" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          disabled={!canSave}
          onClick={onSave}
        >
          Enregistrer le maillage
        </Button>
      </Box>
    </Box>
  );
}
