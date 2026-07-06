import { Box, Switch, Tooltip, Typography } from "@mui/material";

// Compact "Ext." switch for the edit-annotation toolbars (exterior-side flag,
// POLYLINE / STRIP / POLYGON). The displayed value is the RESOLVED one
// (annotation value, falling back to its template's isExt); toggling writes
// an explicit per-annotation value, which then wins over the template.
export default function FieldAnnotationIsExtSwitch({
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <Tooltip title="Côté extérieur">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          ...(disabled && { pointerEvents: "none" }),
        }}
      >
        <Typography
          variant="body2"
          color={disabled ? "text.disabled" : "text.secondary"}
          noWrap
        >
          Ext.
        </Typography>
        <Switch
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </Box>
    </Tooltip>
  );
}
