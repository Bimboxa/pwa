import { useState, useRef, useEffect } from "react";
import { Box, Typography, Popover, IconButton, Slider, InputBase, ToggleButtonGroup, ToggleButton } from "@mui/material";
import {
  Close as CloseIcon,
  Texture as HatchingIcon,
  Square as SolidIcon,
  FormatColorFill as FillIcon
} from "@mui/icons-material";
import { CompactPicker } from "react-color";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

// Composant interne pour l'input d'opacité auto-resizing
function OpacityInput({ value, onChange }) {
  const [width, setWidth] = useState(30);
  const spanRef = useRef(null);

  useEffect(() => {
    const text = value === undefined || value === "" ? "0" : value.toString();
    if (spanRef.current) {
      setWidth(Math.max(25, spanRef.current.offsetWidth + 4));
    }
  }, [value]);

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
      <span ref={spanRef} style={{ position: "absolute", visibility: "hidden", whiteSpace: "pre", fontSize: "0.875rem", fontWeight: "bold" }}>
        {value || "0"}
      </span>
      <InputBase
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value.replace(/[^0-9.]/g, '');
          onChange(val);
        }}
        sx={{ width, fontSize: "0.875rem", fontWeight: "bold", "& input": { textAlign: "right", p: 0 } }}
      />
    </Box>
  );
}

export default function FieldFill({ value, onChange, label = "Remplissage" }) {
  const { fillColor = "#ffffff", fillType = "SOLID", fillOpacity = 1 } = value ?? {};
  const [anchorEl, setAnchorEl] = useState(null);

  // Handlers
  const handleColorChange = (color) => onChange({ ...value, fillColor: color.hex });
  const handleOpacitySlider = (e, val) => onChange({ ...value, fillOpacity: val / 100 });
  const handleTypeChange = (e, newType) => {
    if (newType !== null) onChange({ ...value, fillType: newType });
  };

  const open = Boolean(anchorEl);

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>{label}</Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

        {/* LIGNE 1 : COULEUR (Style FieldColorV2) */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">Couleur</Typography>
          <Box
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              width: 24, height: 24, borderRadius: "50%", bgcolor: fillColor,
              cursor: "pointer", border: "2px solid", borderColor: "divider",
              transition: "transform 0.2s", "&:hover": { transform: "scale(1.1)" }
            }}
          />
        </Box>

        {/* LIGNE 2 : REMPLISSAGE (Toggle avec Icônes) */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">Type</Typography>
          <ToggleButtonGroup
            value={fillType}
            exclusive
            onChange={handleTypeChange}
            size="small"
            sx={{ bgcolor: "action.hover", border: "none", "& .MuiToggleButton-root": { border: "none", borderRadius: 1.5, mx: 0.2, px: 1.5 } }}
          >
            <ToggleButton value="SOLID" title="Plein">
              <SolidIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="HATCHING" title="Hachures Droite">
              <HatchingIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="HATCHING_LEFT" title="Hachures Gauche">
              <HatchingIcon fontSize="small" sx={{ transform: "scaleX(-1)" }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* LIGNE 3 : OPACITÉ (Slider + TextField %) */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>Opacité</Typography>
          <Slider
            size="small"
            value={Math.round(fillOpacity * 100)}
            onChange={handleOpacitySlider}
            sx={{ flex: 1, color: "primary.main" }}
          />
          <Box sx={{ display: "flex", alignItems: "center", bgcolor: "action.hover", px: 1, py: 0.5, borderRadius: 1.5, minWidth: 50, justifyContent: "flex-end" }}>
            <OpacityInput
              value={Math.round(fillOpacity * 100)}
              onChange={(val) => onChange({ ...value, fillOpacity: Number(val) / 100 })}
            />
            <Typography variant="caption" sx={{ ml: 0.5, fontWeight: "bold", color: "text.secondary" }}>%</Typography>
          </Box>
        </Box>
      </Box>

      {/* POPOVER COULEUR */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, p: 0, overflow: "hidden", borderRadius: 2, boxShadow: 6 } } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pl: 2, pr: 1, py: 0.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
          <Typography variant="caption" sx={{ fontWeight: "bold" }}>Couleur de remplissage</Typography>
          <IconButton size="small" onClick={() => setAnchorEl(null)}><CloseIcon fontSize="inherit" /></IconButton>
        </Box>
        <Box sx={{ p: 1 }}>
          <CompactPicker color={fillColor} onChange={handleColorChange} />
        </Box>
      </Popover>
    </WhiteSectionGeneric>
  );
}