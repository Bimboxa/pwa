import { Box, Typography } from "@mui/material";

import FieldColorVariantToolbar from "./FieldColorVariantToolbar";
import FieldOptionKey from "./FieldOptionKey";
import FieldSlider from "./FieldSlider";
import FieldTextV2 from "./FieldTextV2";
import FieldCheck from "./FieldCheck";

export default function FieldSizeAndUnit({ value, onChange }) {
  // strings

  const pointS = "Objet ponctuel";
  const sizeS = "Taille";


  // helpers

  const {
    fillColor,
    variant,
    size = 4,
    sizeUnit = "PX",
  } = value ?? {};

  // hepers options

  const variantOptions = [
    { key: "SQUARE", label: "Carré" },
    { key: "CIRCLE", label: "Rond" },
  ];

  const sizeUnitsOptions = [
    { key: "PX", label: "px" },
    { key: "CM", label: "cm" },
  ];

  // handlers

  function handleColorChange(color) {
    onChange({ ...value, fillColor: color });
  }

  function handleVariantChange(type) {
    onChange({ ...value, variant: type });
  }

  function handleSizeChange(size) {
    onChange({ ...value, size });
  }

  function handleSizeUnitChange(sizeUnit) {
    onChange({ ...value, sizeUnit });
  }


  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {pointS}
      </Typography>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <FieldColorVariantToolbar
          value={fillColor}
          onChange={handleColorChange}
        />
        <FieldOptionKey
          value={variant}
          onChange={handleVariantChange}
          valueOptions={variantOptions}
        />
        <Box sx={{ width: 80, flexShrink: 0 }}>
          <FieldTextV2
            value={size}
            onChange={handleSizeChange}
            label={sizeS}
            options={{
              showLabel: true,
              fullWidth: true,
              isNumber: true,
            }}
          />
        </Box>


        <FieldOptionKey
          value={sizeUnit}
          onChange={handleSizeUnitChange}
          valueOptions={sizeUnitsOptions}
        />

      </Box>
    </Box>
  );
}
