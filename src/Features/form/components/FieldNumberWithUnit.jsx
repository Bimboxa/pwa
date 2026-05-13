import { useState, useEffect, useRef } from "react";
import { Typography, InputBase, Box } from "@mui/material";

export default function FieldNumberWithUnit({
  value,
  onChange,
  label,
  unit = "m",
  helperText,
}) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const debounceTimer = useRef(null);

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const commonFontStyles = {
    fontSize: (theme) => theme.typography.body2?.fontSize,
    fontFamily: (theme) => theme.typography.body2?.fontFamily,
    fontWeight: (theme) => theme.typography.body2?.fontWeight,
    lineHeight: (theme) => theme.typography.body2?.lineHeight || 1.5,
    letterSpacing: "normal",
  };

  const processValue = (inputValue) => {
    const valStr = String(inputValue).replace(",", ".");
    if (valStr === "") return null;
    if (valStr.endsWith(".")) return valStr;
    const numberVal = parseFloat(valStr);
    return !isNaN(numberVal) ? numberVal : valStr;
  };

  function handleChange(e) {
    e.stopPropagation();
    e.preventDefault();
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onChange(processValue(newValue));
    }, 400);
  }

  function handleKeyDown(e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, p: 0.5 }}>
        {label && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {label}
          </Typography>
        )}

        <Box
          sx={{ display: "grid", alignItems: "center", position: "relative" }}
        >
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

        {unit && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {unit}
          </Typography>
        )}
      </Box>

      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
