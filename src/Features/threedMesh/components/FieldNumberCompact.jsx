import { useEffect, useState } from "react";

import { Box, InputBase, Typography } from "@mui/material";

// Compact inline number field: label + grey auto-sized input + optional unit.
// Same visual pattern as FieldAnnotationHeight (ToolbarEditAnnotation): a
// hidden ghost span drives the width, the InputBase overlays it.
export default function FieldNumberCompact({
  label,
  value,
  onChange,
  // Optional: raw text of every keystroke, before parsing. Needed by callers
  // that own the text themselves (extrude toolbar → typed value buffer),
  // otherwise the round-trip through a parsed number would eat intermediate
  // states like "2." on the way back through `value`.
  onChangeText,
  unit,
  disabled = false,
}) {
  // Local text state so the user can type freely ("2.", "2,5", "").
  const [localValue, setLocalValue] = useState(
    value != null ? String(value) : ""
  );

  useEffect(() => {
    setLocalValue(value != null ? String(value) : "");
  }, [value]);

  const commonFontStyles = {
    fontSize: (theme) => theme.typography.body2?.fontSize,
    fontFamily: (theme) => theme.typography.body2?.fontFamily,
    fontWeight: (theme) => theme.typography.body2?.fontWeight,
    lineHeight: (theme) => theme.typography.body2?.lineHeight || 1.5,
    letterSpacing: "normal",
  };

  // handlers

  function handleChange(e) {
    const text = e.target.value;
    setLocalValue(text);
    onChangeText?.(text);
    const parsed = parseFloat(text.replace(",", "."));
    if (Number.isFinite(parsed)) onChange?.(parsed);
  }

  function handleKeyDown(e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        p: 0.5,
        ...(disabled && { pointerEvents: "none" }),
      }}
    >
      <Typography
        variant="body2"
        color={disabled ? "text.disabled" : "text.secondary"}
        noWrap
      >
        {label}
      </Typography>

      <Box sx={{ display: "grid", alignItems: "center", position: "relative" }}>
        {/* Ghost span: sizes the grid cell to the typed value. */}
        <Box
          component="span"
          sx={{
            gridArea: "1 / 1 / 2 / 2",
            visibility: "hidden",
            whiteSpace: "pre",
            minWidth: "30px",
            boxSizing: "border-box",
            px: 1,
            ...commonFontStyles,
          }}
        >
          {localValue || " "}
        </Box>

        <InputBase
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={disabled}
          fullWidth
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            gridArea: "1 / 1 / 2 / 2",
            margin: 0,

            "& .MuiInputBase-input": {
              ...commonFontStyles,
              bgcolor: "background.default",
              color: disabled ? "text.disabled" : undefined,
              px: 1,
              boxSizing: "border-box",
              textAlign: "left",
              height: "100%",
              paddingTop: 0,
              paddingBottom: 0,
            },
          }}
        />
      </Box>

      {unit && (
        <Typography
          variant="body2"
          color={disabled ? "text.disabled" : "text.secondary"}
          noWrap
        >
          {unit}
        </Typography>
      )}
    </Box>
  );
}
