import { Box, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

// ---------------------------------------------------------------------------
// ConstraintValueChip — one value row of the « Contraintes » card of the
// drawing helper (SectionDrawingConstraints): an optional label on the left
// (the measure, or the axis letter in its colour), the live / typed value
// right-aligned, its unit, and the padlock (closed = a typed constraint
// locks the value).
//
// isActive: the row the typed digits feed (rectangle: the targeted axis).
// lockable=false hides the padlock (live display only, no typed constraint).
// children: optional trailing content (e.g. a series total).
// ---------------------------------------------------------------------------

export default function ConstraintValueChip({
  label,
  labelColor,
  value,
  unit,
  locked = false,
  isActive = false,
  lockable = true,
  children,
}) {
  // helpers

  const highlighted = isActive || locked;

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        border: "1px solid",
        borderColor: highlighted ? "primary.main" : "divider",
        bgcolor: highlighted ? "action.hover" : "transparent",
      }}
    >
      {label != null && (
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontWeight: isActive ? 700 : 600,
            color: labelColor ?? (isActive ? "primary.main" : "text.secondary"),
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
      )}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.8rem",
          minWidth: 48,
          textAlign: "right",
          ...(label == null ? { flex: 1 } : {}),
        }}
      >
        {value}
      </Typography>
      {unit && (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem" }}
        >
          {unit}
        </Typography>
      )}
      {children}
      {lockable &&
        (locked ? (
          <LockOutlined sx={{ fontSize: 14, color: "primary.main" }} />
        ) : (
          <LockOpenOutlined sx={{ fontSize: 14, color: "text.disabled" }} />
        ))}
    </Box>
  );
}
