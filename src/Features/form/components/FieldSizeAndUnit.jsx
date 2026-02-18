import { Box, Typography, IconButton, InputBase, Menu, MenuItem, Button } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { Refresh, ArrowDropDown as Down } from "@mui/icons-material";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

// Composant interne pour l'auto-resize
function AutoResizeInput({ value, onChange, placeholder }) {
  const [width, setWidth] = useState(30);
  const spanRef = useRef(null);

  useEffect(() => {
    if (spanRef.current) {
      // Calcul de la largeur basé sur le texte ou le placeholder si vide
      setWidth(Math.max(20, spanRef.current.offsetWidth + 4));
    }
  }, [value, placeholder]);

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
        {value || placeholder}
      </span>
      <InputBase
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
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

export default function FieldSizeAndUnit({ value, onChange }) {
  const { size, sizeUnit = "PX" } = value ?? {};
  const { width, height } = size ?? {};
  const [anchorEl, setAnchorEl] = useState(null);

  const unitOptions = [
    { key: "PX", label: "px" },
    { key: "M", label: 'm' },
  ];

  const selectedOption = unitOptions.find(u => u.key === sizeUnit);
  const unitLabel = selectedOption?.label || "px";

  // Détermine si les champs sont vides pour l'affichage spécial de l'unité
  const isEmpty = !width && !height;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

        {/* Header : Titre + Reset */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", color: "text.primary" }}>
            Dimensions
          </Typography>

          <IconButton size="small" onClick={() => onChange({ ...value, size: null })} sx={{ p: 0.5 }}>
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Bloc principal de saisie */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            bgcolor: "action.hover",
            borderRadius: 2,
            py: 0.75,
            px: 2,
            minHeight: 40,
            justifyContent: "center"
          }}
        >
          {/* Zone des nombres */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AutoResizeInput
              value={width}
              onChange={(v) => onChange({ ...value, size: { ...size, width: v } })}
              placeholder="0"
            />

            <Typography sx={{ color: "text.disabled", fontSize: "0.75rem", fontWeight: "bold" }}>
              ×
            </Typography>

            <AutoResizeInput
              value={height}
              onChange={(v) => onChange({ ...value, size: { ...size, height: v } })}
              placeholder="0"
            />
          </Box>

          {/* Sélecteur d'unité intégré à droite */}
          <Box sx={{ ml: 1, borderLeft: '1px solid', borderColor: 'divider', pl: 1 }}>
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
                "&:hover": { bgcolor: "transparent", color: "primary.main" }
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {unitOptions.map((opt) => (
          <MenuItem
            key={opt.key}
            onClick={() => {
              onChange({ ...value, sizeUnit: opt.key });
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