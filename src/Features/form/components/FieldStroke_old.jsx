import { Box, Typography } from "@mui/material";

import FieldColorVariantToolbar from "./FieldColorVariantToolbar";
import FieldOptionKey from "./FieldOptionKey";
import FieldSlider from "./FieldSlider";
import FieldTextV2 from "./FieldTextV2";
import FieldCheck from "./FieldCheck";

export default function FieldStroke({ value, onChange }) {
  // strings

  const strokeS = "Contour";
  const opacityS = "Opacité";
  const widthS = "Épaisseur";
  const offsetS = "Décalage";

  // helpers

  const {
    strokeColor,
    strokeType,
    strokeOpacity,
    strokeWidth,
    strokeWidthUnit,
    strokeOffset,
  } = value ?? {};

  // hepers options

  const strokeTypeOptions = [
    { key: "NONE", label: "Aucun" },
    { key: "SOLID", label: "Solide" },
    //{ key: "GRADIENT", label: "Gradient" },
    { key: "DASHED", label: "Pointillé" },
  ];

  const strokeWidthUnitsOptions = [
    { key: "PX", label: "px" },
    { key: "CM", label: "cm" },
  ];

  // handlers

  function handleColorChange(color) {
    onChange({ ...value, strokeColor: color });
  }

  function handleTypeChange(type) {
    onChange({ ...value, strokeType: type });
  }

  function handleOpacityChange(opacity) {
    onChange({ ...value, strokeOpacity: opacity });
  }

  function handleWidthChange(width) {
    onChange({ ...value, strokeWidth: width });
  }

  function handleWidthUnitChange(widthUnit) {
    onChange({ ...value, strokeWidthUnit: widthUnit });
  }
  function handleOffsetChange(offset) {
    onChange({ ...value, strokeOffset: offset ? 0 : null });
  }

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {strokeS}
      </Typography>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <FieldColorVariantToolbar
          value={strokeColor}
          onChange={handleColorChange}
        />
        <FieldOptionKey
          value={strokeType}
          onChange={handleTypeChange}
          valueOptions={strokeTypeOptions}
        />
        <Box sx={{ width: 120, flexShrink: 0 }}>
          <FieldTextV2
            value={strokeOpacity}
            onChange={handleOpacityChange}
            label={opacityS}
            options={{
              showLabel: true,
              fullWidth: true,
            }}
          />
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {widthS}
        </Typography>
        <FieldTextV2
          value={strokeWidth}
          onChange={handleWidthChange}
          options={{ isNumber: true }}
        />
        <FieldOptionKey
          value={strokeWidthUnit}
          onChange={handleWidthUnitChange}
          valueOptions={strokeWidthUnitsOptions}
        />

      </Box>

      {/* <FieldCheck
        label={offsetS}
        value={strokeOffset}
        onChange={handleOffsetChange}
        options={{ type: "switch" }}
      /> */}
    </Box>
  );
}
