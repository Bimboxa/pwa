import { Box, Typography, IconButton, InputBase, Menu, MenuItem, Button } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { Refresh, ArrowDropDown as Down } from "@mui/icons-material";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

// --- COMPOSANT INTERNE : AutoResizeInput (Inchangé) ---
function AutoResizeInput({ value, onChange, placeholder }) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const [width, setWidth] = useState(30);
  const spanRef = useRef(null);

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  useEffect(() => {
    if (spanRef.current) {
      setWidth(Math.max(20, spanRef.current.offsetWidth + 4));
    }
  }, [localValue, placeholder]);

  const handleChange = (e) => {
    const rawValue = e.target.value.replace(",", ".");
    setLocalValue(rawValue);
    const isNumeric = !isNaN(parseFloat(rawValue)) && isFinite(rawValue);
    if (rawValue === "" || (isNumeric && !rawValue.endsWith("."))) {
      onChange(rawValue === "" ? null : parseFloat(rawValue));
    }
  };

  const handleBlur = () => {
    const numericValue = parseFloat(localValue);
    if (!isNaN(numericValue)) {
      setLocalValue(numericValue.toString());
      onChange(numericValue);
    } else if (localValue === "") {
      onChange(null);
    } else {
      setLocalValue(value ?? "");
    }
  };

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
      <span
        ref={spanRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          fontSize: "0.875rem",
          fontWeight: 500,
          fontFamily: "inherit"
        }}
      >
        {localValue || placeholder}
      </span>
      <InputBase
        value={localValue}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        sx={{
          width: width,
          fontSize: "0.875rem",
          fontWeight: 500,
          "& input": {
            textAlign: "center",
            p: 0,
            "&::placeholder": { color: "text.disabled", opacity: 1 }
          }
        }}
      />
    </Box>
  );
}

// --- COMPOSANT PRINCIPAL : FieldSizeAndUnit ---
const DEFAULT_UNIT_OPTIONS = [
  { key: "PX", label: "px" },
  { key: "M", label: "m" },
];

export default function FieldSizeAndUnit({ value, onChange, unitOptions = DEFAULT_UNIT_OPTIONS }) {
  // On extrait les valeurs actuelles pour les préserver lors des updates
  const size = value?.size ?? { width: null, height: null };
  const sizeUnit = value?.sizeUnit ?? "PX";

  const [anchorEl, setAnchorEl] = useState(null);

  const selectedOption = unitOptions.find((u) => u.key === sizeUnit);
  const unitLabel = selectedOption?.label || "px";
  const isEmpty = !size.width && !size.height;

  /**
   * CORRECTION : Fusion profonde de l'état
   * On s'assure de toujours conserver le reste de 'value' 
   * ET le reste de 'size' lors d'une modif.
   */
  const handleUpdate = (newSizeProps, newUnit) => {
    onChange({
      ...value,
      sizeUnit: newUnit ?? sizeUnit,
      size: {
        ...size,
        ...newSizeProps
      }
    });
  };

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", color: "text.primary" }}>
            Dimensions
          </Typography>
          <IconButton
            size="small"
            onClick={() => onChange({ ...value, size: null })}
            sx={{ p: 0.5 }}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            bgcolor: "action.hover",
            borderRadius: 2,
            py: 0.75,
            px: 2,
            minHeight: 40,
            justifyContent: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AutoResizeInput
              value={size.width}
              // On ne met à jour que width, handleUpdate préserve le reste
              onChange={(v) => handleUpdate({ width: v })}
              placeholder="0"
            />
            <Typography sx={{ color: "text.disabled", fontSize: "0.75rem", fontWeight: "bold" }}>
              ×
            </Typography>
            <AutoResizeInput
              value={size.height}
              // On ne met à jour que height, handleUpdate préserve le reste
              onChange={(v) => handleUpdate({ height: v })}
              placeholder="0"
            />
          </Box>

          <Box sx={{ ml: 1, borderLeft: "1px solid", borderColor: "divider", pl: 1 }}>
            <Button
              size="small"
              onClick={(e) => setAnchorEl(e.currentTarget)}
              endIcon={<Down sx={{ fontSize: 16, ml: -0.5 }} />}
              sx={{
                textTransform: "none",
                color: isEmpty ? "text.disabled" : "text.secondary",
                fontWeight: isEmpty ? "normal" : "bold",
                fontSize: "0.8125rem",
                minWidth: 0,
                p: 0,
                "&:hover": { bgcolor: "transparent", color: "primary.main" },
              }}
            >
              {isEmpty ? `(${unitLabel})` : unitLabel}
            </Button>
          </Box>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {unitOptions.map((opt) => (
          <MenuItem
            key={opt.key}
            selected={opt.key === sizeUnit}
            onClick={() => {
              // On met à jour l'unité, handleUpdate préserve l'objet size (width/height)
              handleUpdate({}, opt.key);
              setAnchorEl(null);
            }}
          >
            <Typography variant="body2">{opt.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </WhiteSectionGeneric>
  );
}