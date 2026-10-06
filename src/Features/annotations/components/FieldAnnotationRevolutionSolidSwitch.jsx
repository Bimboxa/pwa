import { Box, Switch, Tooltip, Typography } from "@mui/material";

// Compact "Solide" switch for the edit-annotation toolbar (REVOLUTION
// shape3D only). On, the revolved profile is closed toward its axis and the
// 3D object is a watertight volume — usable as a volumetric subtraction
// operand (see isRevolutionSolid in shape3DConfig).
export default function FieldAnnotationRevolutionSolidSwitch({
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <Tooltip title="Solide : volume fermé entre le profil et l'axe (soustractions volumiques)">
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
          Solide
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
