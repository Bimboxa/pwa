import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Popover,
  IconButton,
  Slider,
  InputBase,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Close as CloseIcon,
  HorizontalRule as SolidLineIcon,
  LineStyle as DashedLineIcon,
  ArrowDropDown as Down,
} from "@mui/icons-material";
import { CompactPicker } from "react-color";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import OverrideToggle from "./OverrideToggle";

function AutoResizeInput({ value, onChange, placeholder = "0", suffix = "" }) {
  const [width, setWidth] = useState(30);
  const spanRef = useRef(null);

  useEffect(() => {
    if (spanRef.current) {
      setWidth(Math.max(25, spanRef.current.offsetWidth + 4));
    }
  }, [value]);

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        position: "relative",
      }}
    >
      <span
        ref={spanRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          fontSize: "0.875rem",
          fontWeight: "bold",
          fontFamily: "inherit",
        }}
      >
        {value || placeholder}
      </span>
      <InputBase
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        sx={{
          width,
          fontSize: "0.875rem",
          fontWeight: "bold",
          "& input": { textAlign: "right", p: 0 },
        }}
      />
      {suffix && (
        <Typography
          variant="caption"
          sx={{ ml: 0.5, fontWeight: "bold", color: "text.secondary" }}
        >
          {suffix}
        </Typography>
      )}
    </Box>
  );
}

export default function FieldAnnotationTemplateStroke({
  value,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Contour",
}) {
  const {
    strokeColor = "#000000",
    strokeType = "SOLID",
    strokeOpacity = 1,
    strokeWidth = 1,
    strokeWidthUnit = "PX",
  } = value ?? {};

  const [anchorColor, setAnchorColor] = useState(null);
  const [anchorUnit, setAnchorUnit] = useState(null);

  const strokeWidthUnitsOptions = [
    { key: "PX", label: "px" },
    { key: "CM", label: "cm" },
  ];

  const selectedUnitLabel =
    strokeWidthUnitsOptions.find((u) => u.key === strokeWidthUnit)?.label ||
    "px";

  // handlers

  function handleToggleOverride(field) {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const index = current.indexOf(field);
    if (index >= 0) {
      current.splice(index, 1);
      // Also remove strokeWidthUnit when untoggling strokeWidth
      if (field === "strokeWidth") {
        const unitIndex = current.indexOf("strokeWidthUnit");
        if (unitIndex >= 0) current.splice(unitIndex, 1);
      }
    } else {
      current.push(field);
      // Also add strokeWidthUnit when toggling strokeWidth
      if (field === "strokeWidth" && !current.includes("strokeWidthUnit")) {
        current.push("strokeWidthUnit");
      }
    }
    onOverrideFieldsChange(current);
  }

  const handleTypeChange = (e, newType) => {
    if (newType !== null) onChange({ ...value, strokeType: newType });
  };

  const handleOpacitySlider = (e, val) => {
    onChange({ ...value, strokeOpacity: val / 100 });
  };

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>
        {label}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* COLOR */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <OverrideToggle
            field="strokeColor"
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
                bgcolor: strokeColor,
                cursor: "pointer",
                border: "2px solid",
                borderColor: "divider",
                transition: "transform 0.2s",
                "&:hover": { transform: "scale(1.1)" },
              }}
            />
          </Box>
        </Box>

        {/* TYPE */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <OverrideToggle
            field="strokeType"
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
              Style
            </Typography>
            <ToggleButtonGroup
              value={strokeType}
              exclusive
              onChange={handleTypeChange}
              size="small"
              sx={{
                bgcolor: "action.hover",
                border: "none",
                "& .MuiToggleButton-root": {
                  border: "none",
                  borderRadius: 1.5,
                  mx: 0.2,
                  px: 2,
                  "&.Mui-selected": {
                    bgcolor: "background.paper",
                    boxShadow: 1,
                  },
                },
              }}
            >
              <ToggleButton value="SOLID" title="Plein">
                <SolidLineIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="DASHED" title="Pointillé">
                <DashedLineIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* OPACITY */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <OverrideToggle
            field="strokeOpacity"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flex: 1,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ minWidth: 65 }}
            >
              Opacité
            </Typography>
            <Slider
              size="small"
              value={Math.round(strokeOpacity * 100)}
              onChange={handleOpacitySlider}
              sx={{ flex: 1 }}
            />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                bgcolor: "action.hover",
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                minWidth: 55,
                justifyContent: "flex-end",
              }}
            >
              <AutoResizeInput
                value={Math.round(strokeOpacity * 100)}
                onChange={(val) =>
                  onChange({ ...value, strokeOpacity: Number(val) / 100 })
                }
                suffix="%"
              />
            </Box>
          </Box>
        </Box>

        {/* WIDTH */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <OverrideToggle
            field="strokeWidth"
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
              Épaisseur
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
                value={strokeWidth}
                onChange={(val) => onChange({ ...value, strokeWidth: val })}
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
                    "&:hover": {
                      bgcolor: "transparent",
                      color: "primary.main",
                    },
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
          paper: {
            sx: { mt: 1, p: 0, overflow: "hidden", borderRadius: 2 },
          },
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
            Couleur du contour
          </Typography>
          <IconButton size="small" onClick={() => setAnchorColor(null)}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
        <Box sx={{ p: 1 }}>
          <CompactPicker
            color={strokeColor}
            onChange={(color) =>
              onChange({ ...value, strokeColor: color.hex })
            }
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
        {strokeWidthUnitsOptions.map((opt) => (
          <MenuItem
            key={opt.key}
            onClick={() => {
              onChange({ ...value, strokeWidthUnit: opt.key });
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
