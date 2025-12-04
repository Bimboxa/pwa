import { Box, Typography } from "@mui/material";

import FieldColorVariantToolbar from "./FieldColorVariantToolbar";
import FieldOptionKey from "./FieldOptionKey";
import FieldSlider from "./FieldSlider";
import FieldTextV2 from "./FieldTextV2";

export default function FieldFill({ value, onChange }) {
  // strings

  const fillS = "Remplissage";
  const opacityS = "Opacité 0-1";

  // helpers

  const { fillColor, fillType, fillOpacity } = value ?? {};

  // hepers options

  const fillTypeOptions = [
    { key: "SOLID", label: "Solide" },
    //{ key: "GRADIENT", label: "Gradient" },
    { key: "HATCHING", label: "Hachures" },
  ];

  // handlers

  function handleColorChange(color) {
    onChange({ ...value, fillColor: color });
  }

  function handleTypeChange(type) {
    onChange({ ...value, fillType: type });
  }

  function handleOpacityChange(opacity) {
    opacity = parseFloat(opacity ?? 0.8);
    onChange({ ...value, fillOpacity: opacity });
  }

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {fillS}
      </Typography>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <FieldColorVariantToolbar
          value={fillColor}
          onChange={handleColorChange}
        />
        <FieldOptionKey
          value={fillType}
          onChange={handleTypeChange}
          valueOptions={fillTypeOptions}
        />
        <Box sx={{ width: 120, flexShrink: 0 }}>
          <FieldTextV2
            value={fillOpacity}
            onChange={handleOpacityChange}
            label={opacityS}
            options={{
              showLabel: true,
              fullWidth: true,
            }}
          />
        </Box>

      </Box>


    </Box>
  );
}
