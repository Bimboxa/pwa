import { useSyncExternalStore } from "react";

import { Box } from "@mui/material";

import {
  getRevolutionAxisCutOverlayState,
  subscribeRevolutionAxisCutOverlay,
} from "../services/revolutionAxisCutsStore";

// Same marker as the vertex snap of the 3D drawing / extrude overlays.
const SNAP_COLOR = "#ff2d8d";
const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

// DOM overlay of the horizontal-cut handle drag of a revolution axis (3D
// editor): a circle on the scene vertex the cut takes its altitude from, and
// the live altitude next to the cursor. Driven imperatively by
// useRevolutionAxisCutHandleDragHandlers through revolutionAxisCutsStore;
// pointer-transparent.
export default function RevolutionAxisCutOverlayThreed() {
  // data

  const { snap, cursor } = useSyncExternalStore(
    subscribeRevolutionAxisCutOverlay,
    getRevolutionAxisCutOverlayState
  );

  // render

  if (!snap && !cursor) return null;

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
      {snap && (
        <Box
          sx={{
            position: "absolute",
            left: snap.x,
            top: snap.y,
            width: 2 * SNAP_CIRCLE_RADIUS_PX,
            height: 2 * SNAP_CIRCLE_RADIUS_PX,
            transform: "translate(-50%, -50%)",
            boxSizing: "border-box",
            border: `${SNAP_CIRCLE_STROKE_PX}px solid ${SNAP_COLOR}`,
            borderRadius: "50%",
          }}
        />
      )}
      {cursor && (
        <Box
          sx={{
            position: "absolute",
            left: cursor.x,
            top: cursor.y,
            transform: "translate(14px, 14px)",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: snap ? SNAP_COLOR : "divider",
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
    </Box>
  );
}
