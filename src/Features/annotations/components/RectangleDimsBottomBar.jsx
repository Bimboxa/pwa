import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

function parseBuffer(buf) {
  if (!buf) return null;
  const normalized = buf.replace(",", ".");
  if (normalized === "-" || normalized === "." || normalized === "-.")
    return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function AxisChip({ axis, buffer, value, isActive, unit }) {
  const locked = buffer.length > 0;
  const display =
    buffer.length > 0
      ? buffer
      : Number.isFinite(value)
        ? value.toString()
        : "—";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        border: "1px solid",
        borderColor: isActive ? "primary.main" : "divider",
        bgcolor: isActive ? "action.hover" : "transparent",
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: isActive ? 700 : 600,
          color: isActive ? "primary.main" : "text.secondary",
          fontSize: "0.8rem",
        }}
      >
        {axis}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.8rem",
          minWidth: 40,
          textAlign: "right",
        }}
      >
        {display}
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
  );
}

export default function RectangleDimsBottomBar() {
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const unit = hasScale ? "m" : "px";

  const rectXBuffer = useSelector((s) => s.mapEditor.rectXBuffer);
  const rectYBuffer = useSelector((s) => s.mapEditor.rectYBuffer);
  const rectCurrentAxis = useSelector((s) => s.mapEditor.rectCurrentAxis);
  const rectHasFirstPoint = useSelector(
    (s) => s.mapEditor.rectHasFirstPoint
  );
  const rectX = parseBuffer(rectXBuffer);
  const rectY = parseBuffer(rectYBuffer);

  if (!rectHasFirstPoint) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
          Cliquez pour créer le 1er angle.
        </Typography>
      </Box>
    );
  }

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
        Dimensions :
      </Typography>

      <AxisChip
        axis="X"
        buffer={rectXBuffer}
        value={rectX}
        isActive={rectCurrentAxis === "x"}
        unit={unit}
      />
      <AxisChip
        axis="Y"
        buffer={rectYBuffer}
        value={rectY}
        isActive={rectCurrentAxis === "y"}
        unit={unit}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: 1 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem", whiteSpace: "nowrap" }}
        >
          Cibler
        </Typography>
        <ShortcutBadge>X</ShortcutBadge>
        <ShortcutBadge>Y</ShortcutBadge>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem", whiteSpace: "nowrap" }}
        >
          Signe
        </Typography>
        <ShortcutBadge>-</ShortcutBadge>
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
    </Box>
  );
}
