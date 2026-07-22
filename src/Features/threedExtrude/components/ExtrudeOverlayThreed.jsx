import { useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import {
  getExtrudeOverlayState,
  subscribeExtrudeOverlay,
} from "../services/extrudeOverlayStore";

// DOM overlay of the 3D extrude mode: a single cursor helper showing either
// "Extruder" (hovering an extrudable top face) or the live extrusion value
// once a face is armed. Driven imperatively by useExtrudePointerHandlers
// through extrudeOverlayStore; pointer-transparent.
export default function ExtrudeOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.extrudeMode.active);

  const state = useSyncExternalStore(
    subscribeExtrudeOverlay,
    getExtrudeOverlayState
  );

  if (!active) return null;
  const { cursor } = state;
  if (!cursor) return null;

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
          borderColor: "divider",
          borderRadius: 1,
          px: 0.75,
          py: 0.25,
          fontSize: 12,
          whiteSpace: "nowrap",
          boxShadow: 1,
        }}
      >
        {cursor.label}
      </Box>
    </Box>
  );
}
