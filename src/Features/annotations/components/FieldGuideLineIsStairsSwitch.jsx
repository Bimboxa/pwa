import { Box, Switch, Tooltip, Typography } from "@mui/material";

// Compact "Esc." switch for the guideLine edit toolbar: flags the selected
// guideLine as a stairs flight (isStairs). When on, the slope field is
// replaced by the step count ("Nbre marches").
export default function FieldGuideLineIsStairsSwitch({
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <Tooltip title="Escaliers">
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
          Esc.
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
