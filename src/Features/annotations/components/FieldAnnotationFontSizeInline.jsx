import { useState, useEffect } from "react";

import { Box, Typography, InputBase } from "@mui/material";

const DEFAULT_FONT_SIZE = 14;

// Compact text size field (page pt) for the drawing toolbar — same semantics
// as FieldAnnotationFreeTextSize (writes `fontSize`).
export default function FieldAnnotationFontSizeInline({ value, onChange }) {
  // strings

  const labelS = "Taille";
  const unitS = "pt";

  // state

  const [localValue, setLocalValue] = useState(value ?? DEFAULT_FONT_SIZE);

  useEffect(() => {
    setLocalValue(value ?? DEFAULT_FONT_SIZE);
  }, [value]);

  // handlers

  function handleChange(e) {
    const raw = e.target.value;
    setLocalValue(raw);
    const parsed = Number(String(raw).replace(",", "."));
    if (raw !== "" && Number.isFinite(parsed) && parsed > 0) {
      onChange({ fontSize: parsed });
    }
  }

  function handleBlur() {
    setLocalValue(value ?? DEFAULT_FONT_SIZE);
  }

  function handleKeyDown(e) {
    // keep the map editor hotkeys (tools, delete…) away while typing
    e.stopPropagation();
  }

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, p: 0.5 }}>
      <Typography variant="body2" color="text.secondary" noWrap>
        {labelS}
      </Typography>
      <InputBase
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        inputProps={{ min: 1, step: 1 }}
        sx={{
          width: 56,
          "& .MuiInputBase-input": {
            fontSize: (theme) => theme.typography.body2?.fontSize,
            bgcolor: "background.default",
            px: 1,
            py: 0,
            borderRadius: 0.5,
          },
        }}
      />
      <Typography variant="body2" color="text.secondary" noWrap>
        {unitS}
      </Typography>
    </Box>
  );
}
