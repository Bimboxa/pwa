import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Popover,
  IconButton,
  InputBase,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Close as CloseIcon,
  ArrowDropDown as Down,
} from "@mui/icons-material";
import { CompactPicker } from "react-color";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import OverrideToggle from "./OverrideToggle";

function AutoResizeInput({ value, onChange, onBlur, placeholder = "0" }) {
  const [width, setWidth] = useState(30);
  const spanRef = useRef(null);

  useEffect(() => {
    if (spanRef.current) {
      setWidth(Math.max(25, spanRef.current.offsetWidth + 4));
    }
  }, [value]);

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
      <span
        ref={spanRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          fontSize: "0.875rem",
          fontFamily: "inherit",
        }}
      >
        {value || placeholder}
      </span>
      <InputBase
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        onBlur={onBlur}
        sx={{
          width,
          fontSize: "0.875rem",
          "& input": { textAlign: "right", p: 0 },
        }}
      />
    </Box>
  );
}

export default function FieldAnnotationTemplatePoint({
  value,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  variantOptions = [],
}) {
  const {
    fillColor = "#2196f3",
    variant = "CIRCLE",
    size = 4,
    sizeUnit = "PX",
  } = value ?? {};

  const [anchorColor, setAnchorColor] = useState(null);
  const [anchorUnit, setAnchorUnit] = useState(null);

  const sizeUnitsOptions = [
    { key: "PX", label: "px" },
    { key: "CM", label: "cm" },
  ];

  const selectedUnitLabel =
    sizeUnitsOptions.find((u) => u.key === sizeUnit)?.label || "px";

  // handlers

  function handleToggleOverride(field) {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const index = current.indexOf(field);
    if (index >= 0) {
      current.splice(index, 1);
      // sizeUnit is coupled to size
      if (field === "size") {
        const unitIndex = current.indexOf("sizeUnit");
        if (unitIndex >= 0) current.splice(unitIndex, 1);
      }
    } else {
      current.push(field);
      if (field === "size" && !current.includes("sizeUnit")) {
        current.push("sizeUnit");
      }
    }
    onOverrideFieldsChange(current);
  }

  function handleSizeBlur() {
    let numValue = Number(size);
    if (isNaN(numValue)) numValue = 0;
    onChange({ ...value, size: numValue });
  }

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* COLOR */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <OverrideToggle
            field="fillColor"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Couleur
            </Typography>
            <Box
              onClick={(e) => setAnchorColor(e.currentTarget)}
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                bgcolor: fillColor,
                cursor: "pointer",
                border: "2px solid",
                borderColor: "divider",
                transition: "transform 0.2s",
                "&:hover": { transform: "scale(1.1)" },
              }}
            />
          </Box>
        </Box>

        {/* VARIANT */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <OverrideToggle
            field="variant"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Forme
            </Typography>
            <ToggleSingleSelectorGeneric
              selectedKey={variant}
              options={variantOptions}
              onChange={(key) => onChange({ ...value, variant: key })}
            />
          </Box>
        </Box>

        {/* SIZE */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <OverrideToggle
            field="size"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flex: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Dimension
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                bgcolor: "action.hover",
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                minHeight: 32,
              }}
            >
              <AutoResizeInput
                value={size}
                onChange={(val) => onChange({ ...value, size: val })}
                onBlur={handleSizeBlur}
              />
              <Box
                sx={{
                  ml: 1,
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  pl: 1,
                }}
              >
                <Button
                  size="small"
                  onClick={(e) => setAnchorUnit(e.currentTarget)}
                  endIcon={<Down sx={{ fontSize: 16, ml: -0.5 }} />}
                  sx={{
                    textTransform: "none",
                    color: "text.secondary",
                    fontWeight: "bold",
                    fontSize: "0.8125rem",
                    minWidth: 0,
                    p: 0,
                    "&:hover": { bgcolor: "transparent", color: "primary.main" },
                  }}
                >
                  {selectedUnitLabel}
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* COLOR POPOVER */}
      <Popover
        open={Boolean(anchorColor)}
        anchorEl={anchorColor}
        onClose={() => setAnchorColor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { mt: 1, p: 0, overflow: "hidden", borderRadius: 2 } },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pl: 2,
            pr: 1,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: "bold" }}>
            Couleur
          </Typography>
          <IconButton size="small" onClick={() => setAnchorColor(null)}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
        <Box sx={{ p: 1 }}>
          <CompactPicker
            color={fillColor}
            onChange={(color) => onChange({ ...value, fillColor: color.hex })}
          />
        </Box>
      </Popover>

      {/* UNIT MENU */}
      <Menu
        anchorEl={anchorUnit}
        open={Boolean(anchorUnit)}
        onClose={() => setAnchorUnit(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {sizeUnitsOptions.map((opt) => (
          <MenuItem
            key={opt.key}
            onClick={() => {
              onChange({ ...value, sizeUnit: opt.key });
              setAnchorUnit(null);
            }}
          >
            <Typography variant="body2">{opt.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </WhiteSectionGeneric>
  );
}
