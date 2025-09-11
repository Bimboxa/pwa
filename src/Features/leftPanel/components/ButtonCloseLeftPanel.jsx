import { useDispatch } from "react-redux";

import { setOpenLeftPanel } from "../leftPanelSlice";

import { IconButton, Box } from "@mui/material";
import { ArrowBackIos } from "@mui/icons-material";
import { ChevronLeft } from "@mui/icons-material";

export default function ButtonCloseLeftPanel({ diameter = 50 }) {
  const dispatch = useDispatch();

  // helpers

  const w = diameter / 2; // largeur = D/2
  const h = diameter;

  // handlers

  function handleClose() {
    dispatch(setOpenLeftPanel(false));
  }

  // render

  return (
    <Box
      component="button"
      onClick={handleClose}
      aria-label="Fermer le panneau"
      // place la poignée à mi-hauteur, légèrement “hors” du panneau
      sx={{
        width: w,
        height: h,
        p: 0,
        border: "none",
        cursor: "pointer",
        bgcolor: "primary.main",
        color: "primary.contrastText",

        // arrondi seulement à droite → demi-cercle
        borderTopRightRadius: h / 2,
        borderBottomRightRadius: h / 2,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: 3,
        transition: "background-color .2s ease, transform .2s ease",
        "&:hover": { bgcolor: "primary.dark" },
        //"&:active": { transform: "translateY(-50%) scale(0.98)" },
        // supprime les styles natifs du bouton
        //background: "none",
        //WebkitAppearance: "none",
        //appearance: "none",
      }}
    >
      <ChevronLeft />
    </Box>
  );
}
