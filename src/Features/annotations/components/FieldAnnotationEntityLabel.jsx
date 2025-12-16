import React from "react";
import { Typography, InputBase, Box } from "@mui/material";

export default function FieldAnnotationEntityLabel({ value, onChange }) {
  const label = "Libellé";

  const commonFontStyles = {
    fontSize: (theme) => theme.typography.body2?.fontSize,
    fontFamily: (theme) => theme.typography.body2?.fontFamily,
    fontWeight: (theme) => theme.typography.body2?.fontWeight,
    // On force la line-height pour garantir que fantôme et input aient la même hauteur
    lineHeight: (theme) => theme.typography.body2?.lineHeight || 1.5,
    letterSpacing: "normal",
  };

  async function handleChange(e) {
    e.stopPropagation();
    e.preventDefault();
    let label = e.target.value;
    label.trim();
    console.log("label", label);
    onChange(label);
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

      {/* Le Box Grid doit être en 'relative' pour servir de repère à l'input absolu.
         La largeur de ce Box sera désormais dictée EXCLUSIVEMENT par le fantôme.
      */}
      <Box sx={{ display: "grid", alignItems: "center", position: "relative" }}>
        {/* 1. Le FANTÔME (Maître des dimensions) */}
        <Box
          component="span"
          sx={{
            gridArea: "1 / 1 / 2 / 2",
            visibility: "hidden",
            whiteSpace: "pre",
            minWidth: "100px",
            boxSizing: "border-box",
            px: 1,
            ...commonFontStyles,
          }}
        >
          {value || " "}
        </Box>

        {/* 2. L'INPUT (Esclave des dimensions) */}
        <InputBase
          value={value ?? ""}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          fullWidth
          sx={{
            // Position absolue pour sortir du flux : l'input ne poussera plus la largeur
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
              height: "100%", // S'assurer que le champ de saisie remplit le conteneur
              paddingTop: 0, // Reset paddings verticaux pour centrage aligné sur le fantôme
              paddingBottom: 0,
            },
          }}
        />
      </Box>
    </Box>
  );
}
