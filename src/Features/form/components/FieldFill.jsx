import { Box, Typography } from "@mui/material";

import FieldColorVariantToolbar from "./FieldColorVariantToolbar";
import FieldOptionKey from "./FieldOptionKey";
import FieldSlider from "./FieldSlider";

export default function FieldFill({ value, onChange }) {
  // strings

  const fillS = "Remplissage";
  const opacityS = "Opacité";

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
      </Box>

      <FieldSlider
        label={opacityS}
        value={fillOpacity}
        onChange={handleOpacityChange}
      />
    </Box>
  );
}
