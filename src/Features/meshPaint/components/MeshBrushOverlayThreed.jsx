import { useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { selectIsMeshBrushActive } from "Features/meshPaint/utils/meshBrushSelectors";

import { Box } from "@mui/material";

import {
  getMeshBrushOverlayState,
  subscribeMeshBrushOverlay,
} from "Features/meshPaint/js/meshBrushOverlayStore";

// Accent of the helper per state (the stipple / line preview carries the
// template colour itself).
const TONE_COLOR = {
  PAINT: "text.primary",
  REPLACE: "text.primary",
  REMOVE: "text.secondary",
  REFUSED: "error.main",
};

// DOM overlay of the « Pinceau » (MESH_BRUSH): a cursor helper telling what a
// click does on the part under the cursor — « Peindre », « Retirer »,
// « Remplacer « X » » — or why it cannot be painted. Driven imperatively by
// useMeshBrushPointerHandlers through meshBrushOverlayStore;
// pointer-transparent.
export default function MeshBrushOverlayThreed() {
  // data

  const active = useSelector(selectIsMeshBrushActive);

  const state = useSyncExternalStore(
    subscribeMeshBrushOverlay,
    getMeshBrushOverlayState
  );

  // render

  if (!active) return null;
  const { cursor } = state;
  if (!cursor?.label) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: cursor.x,
          top: cursor.y,
          transform: "translate(14px, 14px)",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: cursor.tone === "REFUSED" ? "error.light" : "divider",
          borderRadius: 1,
          px: 0.75,
          py: 0.25,
          fontSize: 12,
          whiteSpace: "nowrap",
          boxShadow: 1,
          color: TONE_COLOR[cursor.tone] ?? "text.primary",
        }}
      >
        {cursor.label}
      </Box>
    </Box>
  );
}
