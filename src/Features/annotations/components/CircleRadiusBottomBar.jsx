import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import segmentLengthPxRef from "Features/mapEditor/state/segmentLengthPxRef";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// Radius display + lock for the center/radius circle tools. Reuses the same
// constraint buffer as the segment-length lock (digits typed while drawing →
// constraintBuffer → fixedLength), and the live radius is read from
// segmentLengthPxRef (distance center→cursor, populated by the preview).
export default function CircleRadiusBottomBar() {
  // data

  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);

  // state

  const [liveDisplay, setLiveDisplay] = useState("0");
  const rafRef = useRef(null);

  // helpers

  const unit = hasScale ? "m" : "px";
  const locked = constraintBuffer.length > 0;

  const formatLength = useCallback(
    (px) => {
      if (!Number.isFinite(px) || px < 0) return "0";
      const value = hasScale ? px * meterByPx : px;
      if (value < 0.01) return "0";
      return hasScale ? value.toFixed(3) : Math.round(value).toString();
    },
    [hasScale, meterByPx]
  );

  // Live display update via requestAnimationFrame (throttled to ~10fps)
  useEffect(() => {
    if (locked) return;

    let lastUpdate = 0;
    const INTERVAL = 100; // ms

    function tick(timestamp) {
      if (timestamp - lastUpdate >= INTERVAL) {
        lastUpdate = timestamp;
        const px = segmentLengthPxRef.current ?? 0;
        setLiveDisplay(formatLength(px));
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [locked, formatLength]);

  // render

  const displayValue = locked ? constraintBuffer : liveDisplay;

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
        sx={{ color: "text.secondary", fontSize: "0.8rem", whiteSpace: "nowrap" }}
      >
        Rayon :
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
          {unit}
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
          sx={{ color: "text.secondary", fontSize: "0.75rem", whiteSpace: "nowrap" }}
        >
          Contraindre
        </Typography>
        <ShortcutBadge>0-9</ShortcutBadge>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem", whiteSpace: "nowrap" }}
        >
          Valider
        </Typography>
        <ShortcutBadge>↵</ShortcutBadge>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem", whiteSpace: "nowrap" }}
        >
          Effacer
        </Typography>
        <ShortcutBadge>⌫</ShortcutBadge>
      </Box>
    </Box>
  );
}
