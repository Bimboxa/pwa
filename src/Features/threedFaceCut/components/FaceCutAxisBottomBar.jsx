import { useSyncExternalStore } from "react";
import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

import {
  getFaceCutAxisHover,
  subscribeFaceCutAxisHover,
} from "../services/faceCutAxisStore";
import { getFaceCutAxis } from "../utils/faceCutTools";

// Bottom bar of « Découpe horizontale / verticale » (Coupe face, 3D): the
// distance from the face's bottom corner to the cut line — live from the
// hover (FaceCutAxisOverlayThreed), or the typed constraint (locked) —, and
// the side the vertical cut measures from (S).
export default function FaceCutAxisBottomBar() {
  // strings

  const heightS = "Hauteur de coupe :";
  const distanceS = "Distance de coupe :";
  const typeS = "Contraindre";
  const eraseS = "Effacer";
  const sideS = "Côté";
  const leftS = "gauche";
  const rightS = "droite";

  // data

  const axis = useSelector((s) =>
    getFaceCutAxis(s.mapEditor.enabledDrawingMode)
  );
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);
  const side = useSelector((s) => s.threedEditor.drawingMode.faceCutSide);
  const hover = useSyncExternalStore(
    subscribeFaceCutAxisHover,
    getFaceCutAxisHover
  );

  // helpers

  const locked = constraintBuffer.length > 0;
  const liveDistance = hover?.distance;
  const displayValue = locked
    ? constraintBuffer
    : Number.isFinite(liveDistance)
      ? liveDistance.toFixed(3)
      : "—";

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1,
        py: 0.5,
        flexWrap: "wrap",
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          fontSize: "0.8rem",
          whiteSpace: "nowrap",
        }}
      >
        {axis === "H" ? heightS : distanceS}
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          border: "1px solid",
          borderColor: locked ? "primary.main" : "divider",
          bgcolor: locked ? "action.hover" : "transparent",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            fontSize: "0.8rem",
            minWidth: 48,
            textAlign: "right",
          }}
        >
          {displayValue}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem" }}
        >
          m
        </Typography>
        {locked ? (
          <LockOutlined sx={{ fontSize: 14, color: "primary.main" }} />
        ) : (
          <LockOpenOutlined sx={{ fontSize: 14, color: "text.disabled" }} />
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
          }}
        >
          {typeS}
        </Typography>
        <ShortcutBadge>0-9</ShortcutBadge>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
          }}
        >
          {eraseS}
        </Typography>
        <ShortcutBadge>⌫</ShortcutBadge>
      </Box>

      {axis === "V" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontSize: "0.75rem",
              whiteSpace: "nowrap",
            }}
          >
            {`${sideS} : ${side === "RIGHT" ? rightS : leftS}`}
          </Typography>
          <ShortcutBadge>S</ShortcutBadge>
        </Box>
      )}
    </Box>
  );
}
