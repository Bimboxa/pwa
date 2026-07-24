import React, { useState, useEffect, useRef } from "react";
import { Typography, InputBase, Box, Menu, MenuItem } from "@mui/material";

import FieldShortcutBadge from "./FieldShortcutBadge";

const FIELD = "strokeWidth";
const UNIT_FIELD = "strokeWidthUnit";
const UNIT_OPTIONS = ["PX", "CM"];

export default function FieldAnnotationThickness({
  annotation,
  onChange,
  disabled = false,
  active = false,
  shortcut,
}) {
  const [localValue, setLocalValue] = useState(annotation?.[FIELD] ?? "");
  const [unitAnchorEl, setUnitAnchorEl] = useState(null);

  const debounceTimer = useRef(null);

  useEffect(() => {
    setLocalValue(annotation?.[FIELD] ?? "");
  }, [annotation?.[FIELD], annotation?.id]);

  const commonFontStyles = {
    fontSize: (theme) => theme.typography.body2?.fontSize,
    fontFamily: (theme) => theme.typography.body2?.fontFamily,
    fontWeight: (theme) => theme.typography.body2?.fontWeight,
    lineHeight: (theme) => theme.typography.body2?.lineHeight || 1.5,
    letterSpacing: "normal",
  };

  const unit = annotation?.[UNIT_FIELD] ?? "PX";
  const unitLabel = unit.toLowerCase();

  const processValue = (inputValue) => {
    let valStr = String(inputValue).replace(",", ".");
    if (valStr.endsWith(".")) return valStr;
    const numberVal = parseFloat(valStr);
    return !isNaN(numberVal) ? numberVal : valStr;
  };

  function handleChange(e) {
    if (!annotation || disabled) return;
    e.stopPropagation();
    e.preventDefault();

    const newValue = e.target.value;
    setLocalValue(newValue);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      const finalValue = processValue(newValue);
      onChange({ ...annotation, [FIELD]: finalValue });
    }, 400);
  }

  function handleKeyDown(e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }
  }

  function handleOpenUnit(e) {
    if (disabled) return;
    setUnitAnchorEl(e.currentTarget);
  }

  function handleSelectUnit(nextUnit) {
    setUnitAnchorEl(null);
    if (!annotation || nextUnit === unit) return;
    onChange({ ...annotation, [UNIT_FIELD]: nextUnit });
  }

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
        color={
          disabled
            ? "text.disabled"
            : active
              ? "primary.main"
              : "text.secondary"
        }
        noWrap
      >
        Ep.
      </Typography>

      {shortcut && <FieldShortcutBadge active={active}>{shortcut}</FieldShortcutBadge>}

      <Box sx={{ display: "grid", alignItems: "center", position: "relative" }}>
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
              borderRadius: 0.5,
              boxShadow: active
                ? (theme) => `inset 0 0 0 1.5px ${theme.palette.primary.main}`
                : "none",
            },
          }}
        />
      </Box>

      <Typography
        variant="body2"
        color={disabled ? "text.disabled" : "text.secondary"}
        noWrap
        onClick={handleOpenUnit}
        sx={{
          cursor: disabled ? "default" : "pointer",
          px: 0.5,
          borderRadius: 0.5,
          ...(!disabled && { "&:hover": { bgcolor: "action.hover" } }),
        }}
      >
        {unitLabel}
      </Typography>

      <Menu
        anchorEl={unitAnchorEl}
        open={Boolean(unitAnchorEl)}
        onClose={() => setUnitAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {UNIT_OPTIONS.map((opt) => (
          <MenuItem
            key={opt}
            selected={opt === unit}
            onClick={() => handleSelectUnit(opt)}
            dense
          >
            {opt.toLowerCase()}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
