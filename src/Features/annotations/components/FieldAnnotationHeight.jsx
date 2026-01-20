import React, { useState, useEffect, useRef } from "react";
import { Typography, InputBase, Box } from "@mui/material";

export default function FieldAnnotationHeight({ annotation, onChange }) {
  const label = "ht.";

  // 1. We need local state to manage the input value immediately while typing
  const [localValue, setLocalValue] = useState(annotation?.height ?? "");

  // 2. We use a ref to store the timer ID so it persists across renders
  const debounceTimer = useRef(null);

  // 3. Sync local state if the prop changes externally (e.g. selecting a different node)
  useEffect(() => {
    setLocalValue(annotation?.height ?? "");
  }, [annotation?.height, annotation?.id]);

  const commonFontStyles = {
    fontSize: (theme) => theme.typography.body2?.fontSize,
    fontFamily: (theme) => theme.typography.body2?.fontFamily,
    fontWeight: (theme) => theme.typography.body2?.fontWeight,
    lineHeight: (theme) => theme.typography.body2?.lineHeight || 1.5,
    letterSpacing: "normal",
  };

  /**
   * Logic to determine if we send a Number or a String
   */
  const processValue = (inputValue) => {
    // Normalize string
    let valStr = String(inputValue).replace(",", ".");

    // Rule: If it ends with a dot (e.g. "2."), keep as string
    if (valStr.endsWith(".")) {
      return valStr;
    }

    // Attempt conversion
    const numberVal = parseFloat(valStr);

    // Rule: If it is a valid number, return Number type. 
    // Otherwise (empty string, text, etc.), return the sanitized string.
    return !isNaN(numberVal) ? numberVal : valStr;
  };

  async function handleChange(e) {
    if (!annotation) return;
    e.stopPropagation();
    e.preventDefault();

    const newValue = e.target.value;

    // 1. Update UI immediately
    setLocalValue(newValue);

    // 2. Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 3. Set new timer (Debounce 400ms)
    debounceTimer.current = setTimeout(() => {
      const finalValue = processValue(newValue);

      // Commit change to parent
      onChange({ ...annotation, height: finalValue });
    }, 400);
  }

  function handleKeyDown(e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, p: 0.5 }}>
      <Typography variant="body2" color="text.secondary" noWrap>
        {label}
      </Typography>

      <Box sx={{ display: "grid", alignItems: "center", position: "relative" }}>
        {/* 1. Le FANTÔME (Maître des dimensions) - Uses localValue now */}
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

        {/* 2. L'INPUT (Esclave des dimensions) - Uses localValue now */}
        <InputBase
          value={localValue}
          onChange={handleChange}
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
              ...commonFontStyles,
              bgcolor: "background.default",
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

      <Typography variant="body2" color="text.secondary" noWrap>
        m
      </Typography>
    </Box>
  );
}