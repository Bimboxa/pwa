import { useState, useEffect, useRef, useCallback } from "react";

import { Box, Typography, alpha } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { useDrawingMetrics } from "App/contexts/DrawingMetricsContext";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

export default function SectionSegmentLength() {
  // data

  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const { segmentLengthPxRef, constraintBuffer } = useDrawingMetrics();

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
        const px = segmentLengthPxRef?.current ?? 0;
        setLiveDisplay(formatLength(px));
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [locked, formatLength, segmentLengthPxRef]);

  // render

  const displayValue = locked ? constraintBuffer : liveDisplay;

  return (
    <Box
      sx={{
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
        backdropFilter: "blur(8px)",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        p: 2,
        mb: 1,
      }}
    >
      {/* Current segment length row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
          Segment en cours
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              fontSize: "0.85rem",
              minWidth: 56,
              textAlign: "right",
            }}
          >
            {displayValue}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
            {unit}
          </Typography>
          {locked ? (
            <LockOutlined sx={{ fontSize: 16, color: "primary.main" }} />
          ) : (
            <LockOpenOutlined sx={{ fontSize: 16, color: "text.disabled" }} />
          )}
        </Box>
      </Box>

      {/* Length-constraint shortcut rows */}
      <Box
        sx={{
          mt: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ flex: 1, fontSize: "0.85rem" }}>
          Contraindre la longueur du segment
        </Typography>
        <ShortcutBadge>0-9</ShortcutBadge>
      </Box>
      <Box
        sx={{
          mt: 0.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ flex: 1, fontSize: "0.85rem" }}>
          Effacer la contrainte de longueur
        </Typography>
        <ShortcutBadge>⌫</ShortcutBadge>
      </Box>
    </Box>
  );
}
