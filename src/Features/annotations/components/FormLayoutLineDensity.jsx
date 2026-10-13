import {
  Box,
  Typography,
  InputBase,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

import FieldTextV2 from "Features/form/components/FieldTextV2";

// Same options / styles as FieldAnnotationTemplateLinearLayout (kept local:
// the band-specific fields of that form do not apply to a layout line).
const DENSITY_MODE_OPTIONS = [
  { value: "SPACING", label: "Espacement (cm)" },
  { value: "PER_METER", label: "Barres / m" },
];

const ALIGN_OPTIONS = [
  { value: "LEFT", label: "Gauche" },
  { value: "CENTER", label: "Centré" },
  { value: "RIGHT", label: "Droite" },
];

const toggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
    fontSize: "0.7rem",
  },
};

const numberInputSx = {
  width: 64,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  px: 1,
  height: 28,
  fontSize: "0.8rem",
  "& input": { textAlign: "center", p: 0 },
};

// Density / alignment form of ONE layout line (ligne de calepinage).
// `line` carries densityMode / densityValue / densityUnitLabel / layoutAlign;
// `onChange(patch)` receives only the changed field.
export default function FormLayoutLineDensity({ line, onChange }) {
  // data

  const {
    densityMode = "SPACING",
    densityValue = 33,
    densityUnitLabel = "",
    layoutAlign = "CENTER",
  } = line ?? {};

  // render

  return (
    <Box
      sx={{
        "& > *": { borderTop: "1px solid", borderColor: "divider" },
        "& > *:first-of-type": { borderTop: "none" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          Densité
        </Typography>
        <ToggleButtonGroup
          value={densityMode}
          exclusive
          onChange={(e, v) => v !== null && onChange({ densityMode: v })}
          size="small"
          sx={toggleGroupSx}
        >
          {DENSITY_MODE_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {densityMode === "PER_METER" ? "Barres / m" : "Espacement"}
        </Typography>
        <InputBase
          type="number"
          value={densityValue ?? ""}
          onChange={(e) => onChange({ densityValue: e.target.value })}
          endAdornment={
            <Typography variant="caption" color="text.secondary">
              {densityMode === "PER_METER" ? "/m" : "cm"}
            </Typography>
          }
          sx={numberInputSx}
        />
      </Box>

      {densityMode === "PER_METER" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, flexShrink: 0 }}>
            Unité affichée
          </Typography>
          <Box sx={{ width: 120 }}>
            <FieldTextV2
              value={densityUnitLabel}
              onChange={(v) => onChange({ densityUnitLabel: v })}
              options={{ fullWidth: true, placeholder: "barres/m" }}
            />
          </Box>
        </Box>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          Alignement
        </Typography>
        <ToggleButtonGroup
          value={layoutAlign}
          exclusive
          onChange={(e, v) => v !== null && onChange({ layoutAlign: v })}
          size="small"
          sx={toggleGroupSx}
        >
          {ALIGN_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
}
