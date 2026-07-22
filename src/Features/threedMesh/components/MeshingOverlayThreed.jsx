import { useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import {
  getMeshingOverlayState,
  subscribeMeshingOverlay,
} from "../services/meshingOverlayStore";

// DOM overlay of the 3D meshing mode: cursor helper ("+ nouvelle maille"),
// dark area chips (would-be piece surfaces under a cut line) and the pink
// offset chip ("2m" between reference and guide vertices). Driven imperatively
// by useMeshingPointerHandlers through meshingOverlayStore; everything is
// pointer-transparent.
export default function MeshingOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.meshingMode.active);

  const state = useSyncExternalStore(
    subscribeMeshingOverlay,
    getMeshingOverlayState
  );

  if (!active) return null;
  const { cursor, areaChips, offsetChip, angleChip } = state;

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
      {cursor && (
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
      )}

      {(areaChips || []).map((chip, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            left: chip.x,
            top: chip.y,
            transform: "translate(-50%, -50%)",
            bgcolor: "#0d3b56",
            color: "#fff",
            borderRadius: "10px",
            px: 1,
            py: 0.25,
            fontSize: 12,
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          {chip.text}
        </Box>
      ))}

      {offsetChip && (
        <Box
          sx={{
            position: "absolute",
            left: offsetChip.x,
            top: offsetChip.y,
            transform: "translate(-50%, -50%)",
            bgcolor: "#f8c9c9",
            color: "#b71c1c",
            borderRadius: "8px",
            px: 1,
            py: 0.25,
            fontSize: 12,
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          {offsetChip.text}
        </Box>
      )}

      {angleChip && (
        <Box
          sx={{
            position: "absolute",
            left: angleChip.x,
            top: angleChip.y,
            transform: "translate(-50%, -50%)",
            bgcolor: angleChip.typed ? "#b71c1c" : "#f8c9c9",
            color: angleChip.typed ? "#fff" : "#b71c1c",
            borderRadius: "8px",
            px: 1,
            py: 0.25,
            fontSize: 12,
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          {angleChip.text}
        </Box>
      )}
    </Box>
  );
}
