import { useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

import {
  getExtrudeOverlayState,
  subscribeExtrudeOverlay,
} from "../services/extrudeOverlayStore";

// Same marker as the vertex snap of the 3D drawing overlay.
const SNAP_COLOR = "#ff2d8d";
const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

// DOM overlay of the 3D extrude mode: a cursor helper showing either
// "Extruder" (hovering an extrudable top face) or the live extrusion value
// once a face is armed, plus a circle on the scene vertex the armed face is
// snapped on. The armed value carries the same padlock as the 2D segment
// length constraint (SectionSegmentLengthConstraint): closed while a typed value
// holds it, open while the mouse drives it. Driven imperatively by useExtrudePointerHandlers through
// extrudeOverlayStore; pointer-transparent.
export default function ExtrudeOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.extrudeMode.active);
  const valueBuffer = useSelector(
    (s) => s.threedEditor.extrudeMode.valueBuffer
  );
  const targetAnnotationId = useSelector(
    (s) => s.threedEditor.extrudeMode.targetAnnotationId
  );

  const state = useSyncExternalStore(
    subscribeExtrudeOverlay,
    getExtrudeOverlayState
  );

  if (!active) return null;
  const { cursor, snap } = state;
  const armed = Boolean(targetAnnotationId);
  const locked = armed && valueBuffer !== "";
  if (!cursor && !snap) return null;

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
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: locked ? "primary.main" : "divider",
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            fontSize: 12,
            whiteSpace: "nowrap",
            boxShadow: 1,
          }}
        >
          {cursor.label}
          {armed &&
            (locked ? (
              <LockOutlined sx={{ fontSize: 14, color: "primary.main" }} />
            ) : (
              <LockOpenOutlined sx={{ fontSize: 14, color: "text.disabled" }} />
            ))}
        </Box>
      )}
    </Box>
  );
}
