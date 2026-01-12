import { Box, Typography, IconButton } from "@mui/material";

import FieldColorVariantToolbar from "./FieldColorVariantToolbar";
import FieldOptionKey from "./FieldOptionKey";
import FieldSlider from "./FieldSlider";
import FieldTextV2 from "./FieldTextV2";
import { Refresh } from "@mui/icons-material";

export default function FieldSizeAndUnit({ value, onChange }) {
  // strings

  const bboxSizeS = "Dimensions";

  // helpers

  const { size, sizeUnit } = value ?? {};
  const { width, height } = size ?? {};

  // hepers options

  const unitOptions = [
    { key: "PX", label: "px" },
    { key: "M", label: 'm' },
  ];

  // handlers 

  function handleWidthChange(width) {
    onChange({ ...value, size: { ...size, width } });
  }

  function handleHeightChange(height) {
    onChange({ ...value, size: { ...size, height } });
  }

  function handleUnitChange(unit) {
    onChange({ ...value, sizeUnit: unit });
  }

  function handleReset() {
    onChange({ ...value, size: null });
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {bboxSizeS}
          </Typography>
          <FieldOptionKey
            value={sizeUnit}
            onChange={handleUnitChange}
            valueOptions={unitOptions}
          />
        </Box>

        <IconButton onClick={handleReset}>
          <Refresh />
        </IconButton>

      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Box sx={{ flex: 1 }}>
          <FieldTextV2
            value={width}
            onChange={handleWidthChange}
            label="Dim x-x"
            options={{
              showLabel: true,
              fullWidth: true,
            }}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <FieldTextV2
            value={height}
            onChange={handleHeightChange}
            label="Dim y-y"
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
