import { useEffect, useRef, useState } from "react";

import { Box, InputBase, Typography } from "@mui/material";

// Compact "label · grey input · unit" field, mirroring the style of
// FieldAnnotationHeight in the annotation toolbar. The input width auto-fits
// the value via a hidden phantom span.
//
// Props:
// - label    : leading label (e.g. "X", "ht.", "Offset")
// - value    : current value (string)
// - onChange : called on each keystroke with the raw string
// - onCommit : called on blur or Enter
// - unit     : optional trailing unit label (e.g. "m", "°")
// - minWidth : minimum width of the input box in px (default 30)
export default function FieldMeasure({
  label,
  value,
  onChange,
  onCommit,
  unit = "m",
  minWidth = 30,
}) {
  const [local, setLocal] = useState(String(value ?? ""));
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocal(String(value ?? ""));
  }, [value]);

  const fontStyles = {
    fontSize: (theme) => theme.typography.body2?.fontSize,
    fontFamily: (theme) => theme.typography.body2?.fontFamily,
    fontWeight: (theme) => theme.typography.body2?.fontWeight,
    lineHeight: (theme) => theme.typography.body2?.lineHeight || 1.5,
    letterSpacing: "normal",
  };

  function handleChange(e) {
    e.stopPropagation();
    const next = e.target.value.replace(",", ".");
    setLocal(next);
    onChange?.(next);
  }

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onCommit?.(local);
  }

  function handleKeyDown(e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {label != null && (
        <Typography variant="body2" color="text.secondary" noWrap>
          {label}
        </Typography>
      )}

      <Box sx={{ display: "grid", alignItems: "center", position: "relative" }}>
        <Box
          component="span"
          sx={{
            gridArea: "1 / 1 / 2 / 2",
            visibility: "hidden",
            whiteSpace: "pre",
            minWidth,
            boxSizing: "border-box",
            px: 1,
            ...fontStyles,
          }}
        >
          {local || " "}
        </Box>
        <InputBase
          value={local}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
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
              ...fontStyles,
              bgcolor: "background.default",
              px: 1,
              boxSizing: "border-box",
              textAlign: "left",
              height: "100%",
              py: 0,
            },
          }}
        />
      </Box>

      {unit && (
        <Typography variant="body2" color="text.secondary" noWrap>
          {unit}
        </Typography>
      )}
    </Box>
  );
}
