import { useDispatch, useSelector } from "react-redux";

import { setDrawingModeActive } from "Features/threedEditor/threedEditorSlice";

import EditIcon from "@mui/icons-material/Edit";
import { Button, Tooltip } from "@mui/material";

export default function ButtonDrawThreed() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.drawingMode.active);

  function handleClick() {
    dispatch(setDrawingModeActive(!active));
  }

  const title = active
    ? "Quitter le mode dessin (Esc pour annuler la polyligne)"
    : "Dessiner — clic = sommet, Entrée = trait persistant, fermeture = annotation";

  return (
    <Tooltip title={title}>
      <Button
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        onClick={handleClick}
        startIcon={<EditIcon sx={{ fontSize: 18 }} />}
        size="small"
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Dessiner
      </Button>
    </Tooltip>
  );
}
