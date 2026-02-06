import React from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Divider,
} from "@mui/material";
import { styled } from "@mui/material/styles";

// Conteneur du groupe : inchangé
const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "12px",
  "& .MuiToggleButtonGroup-grouped": {
    margin: 0,
    border: 0,
    borderRadius: (theme.vars || theme).shape.borderRadius,
    "&:not(:first-of-type)": {
      borderRadius: (theme.vars || theme).shape.borderRadius,
      border: 0,
    },
    "&:first-of-type": {
      borderRadius: (theme.vars || theme).shape.borderRadius,
    },
  },
}));

// Le bouton individuel : Style de sélection modifié
const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  width: "70px",
  height: "65px",
  padding: "8px 4px",
  backgroundColor: "transparent",
  textTransform: "none",
  color: theme.palette.text.secondary,
  transition: "all 0.2s ease",

  "&:hover": {
    // Un gris très léger au survol
    backgroundColor: theme.palette.action.hover,
  },

  "&.Mui-selected": {
    // MODIFICATION ICI : Fond gris clair subtil au lieu du style foncé/surélevé
    backgroundColor: theme.palette.action.selected, // Utilise la couleur de sélection standard de MUI (gris clair)
    color: theme.palette.text.secondary, // Le texte reste de la même couleur
    // Pas de boxShadow
    "&:hover": {
      // Un gris légèrement plus foncé au survol de l'élément sélectionné
      backgroundColor: theme.palette.action.selectedHover,
    },
  },
}));

// Petit composant pour le texte sous l'icône : inchangé
const LabelTypography = styled(Typography)({
  marginTop: "4px",
});

export default function VerticalMenu({
  menuItems,
  selection,
  onSelectionChange,
  tooltipPlacement = "right",
}) {
  const handleChange = (e, newKey) => {

    onSelectionChange(newKey);

  };

  return (
    <Box
      sx={{
        p: 1,
        width: "fit-content",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Fond transparent ou léger selon votre besoin
        //bgcolor: "background.paper",
      }}
    >
      <StyledToggleButtonGroup
        value={selection}
        exclusive
        onChange={handleChange}
        orientation="vertical"
      >
        {menuItems.map((item, index) => {
          if (item.type === 'divider') {
            return <Divider key={`div-${index}`} sx={{ width: '60%', my: 1 }} />;
          }

          return (

            <StyledToggleButton value={item.key}>
              {item.icon}
              <LabelTypography variant="caption">
                {item.label}
              </LabelTypography>
            </StyledToggleButton>

          );
        })}
      </StyledToggleButtonGroup>
    </Box>
  );
}