import { useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

import {
  getVertexOffsetOverlayState,
  subscribeVertexOffsetOverlay,
} from "../services/vertexOffsetOverlayStore";

// Same markers as the 3D drawing overlay: pink on a vertex, green on an edge.
const SNAP_COLORS = { VERTEX: "#ff2d8d", EDGE: "#2e7d32" };
const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;
const AXIS_COLOR = "#1565c0";

// DOM overlay of the vertex offset mode: the dashed vertical helper through
// the armed vertex (it only moves along the base map normal), a circle on the
// scene vertex / edge point its level is snapped on, and the cursor chip with
// the live offset of the point — closed padlock while a typed value holds it,
// open while the mouse drives it (same look as ExtrudeOverlayThreed). Driven
// imperatively by useVertexOffsetPointerHandlers; pointer-transparent.
export default function VertexOffsetOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.vertexOffsetMode.active);
  const armedPointId = useSelector(
    (s) => s.threedEditor.vertexOffsetMode.armedPointId
  );
  const valueBuffer = useSelector(
    (s) => s.threedEditor.vertexOffsetMode.valueBuffer
  );

  const state = useSyncExternalStore(
    subscribeVertexOffsetOverlay,
    getVertexOffsetOverlayState
  );

  if (!active || !armedPointId) return null;
  const { cursor, snap, axisLine } = state;
  const locked = valueBuffer !== "";
  if (!cursor && !snap && !axisLine) return null;

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
      {axisLine && (
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <line
            x1={axisLine.from.x}
            y1={axisLine.from.y}
            x2={axisLine.to.x}
            y2={axisLine.to.y}
            stroke={AXIS_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </svg>
      )}
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
            border: `${SNAP_CIRCLE_STROKE_PX}px solid ${SNAP_COLORS[snap.kind] ?? SNAP_COLORS.VERTEX}`,
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
          {locked ? (
            <LockOutlined sx={{ fontSize: 14, color: "primary.main" }} />
          ) : (
            <LockOpenOutlined sx={{ fontSize: 14, color: "text.disabled" }} />
          )}
        </Box>
      )}
    </Box>
  );
}
