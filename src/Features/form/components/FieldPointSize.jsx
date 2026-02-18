import { Box, Typography, InputBase, InputAdornment, Button, Menu, MenuItem } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { ArrowDropDown as Down } from "@mui/icons-material";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldPointSize({ value, onChange, label }) {
  const { size = 4, sizeUnit = "PX" } = value ?? {};
  const [anchorEl, setAnchorEl] = useState(null);
  const spanRef = useRef(null);
  const [inputWidth, setInputWidth] = useState(30); // Largeur minimale

  const sizeUnitsOptions = [
    { key: "PX", label: "px" },
    { key: "CM", label: "cm" },
  ];

  const selectedOption = sizeUnitsOptions.find((o) => o.key === sizeUnit);

  // Ajuste la largeur dès que la valeur change
  useEffect(() => {
    if (spanRef.current) {
      // On ajoute une petite marge de sécurité (10px)
      setInputWidth(Math.max(30, spanRef.current.offsetWidth + 10));
    }
  }, [size]);

  const handleSizeChange = (e) => {
    let newValue = e.target.value.replace(",", ".");
    onChange({ ...value, size: newValue });
  };

  const handleBlur = () => {
    let numValue = Number(size);
    if (isNaN(numValue)) numValue = 0;
    onChange({ ...value, size: numValue });
  };

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>

        {/* Conteneur stylisé qui simule le champ */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            bgcolor: "action.hover",
            borderRadius: 2,
            px: 1.5,
            py: 0.5,
            minHeight: 40,
            transition: "all 0.2s ease",
            "&:focus-within": {
              bgcolor: "action.selected",
              boxShadow: "0 0 0 1px inset rgba(0,0,0,0.1)"
            }
          }}
        >
          {/* Span invisible servant de guide pour la largeur */}
          <span
            ref={spanRef}
            style={{
              position: "absolute",
              visibility: "hidden",
              whiteSpace: "pre",
              fontSize: "0.875rem",
              fontWeight: 400,
              fontFamily: "inherit"
            }}
          >
            {size || ""}
          </span>

          <InputBase
            value={size}
            onChange={handleSizeChange}
            onBlur={handleBlur}
            sx={{
              width: inputWidth,
              fontSize: "0.875rem",
              "& input": {
                textAlign: "right",
                p: 0,
                // On retire les flèches des inputs number pour plus de pureté
                "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
                  display: "none"
                }
              }
            }}
          />

          <Box sx={{ ml: 0.5, display: "flex", alignItems: "center" }}>
            <Button
              size="small"
              onClick={(e) => setAnchorEl(e.currentTarget)}
              endIcon={<Down sx={{ fontSize: 16, ml: -0.5 }} />}
              sx={{
                minWidth: 0,
                p: 0,
                textTransform: "none",
                color: "text.secondary",
                fontSize: "0.875rem"
              }}
            >
              {selectedOption?.label}
            </Button>
          </Box>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {sizeUnitsOptions.map((option) => (
            <MenuItem
              key={option.key}
              onClick={() => {
                onChange({ ...value, sizeUnit: option.key });
                setAnchorEl(null);
              }}
            >
              <Typography variant="body2">{option.label}</Typography>
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </WhiteSectionGeneric>
  );
}