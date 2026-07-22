import { useDispatch, useSelector } from "react-redux";

import { setExtrudeModeActive } from "Features/threedEditor/threedEditorSlice";

import HeightIcon from "@mui/icons-material/Height";
import { Button, Tooltip } from "@mui/material";

export default function ButtonExtrudeThreed() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.extrudeMode.active);

  function handleClick() {
    dispatch(setExtrudeModeActive(!active));
  }

  const title = active
    ? "Quitter le mode extrusion (Esc)"
    : "Extruder — clic sur une face du dessus, déplacez la souris, clic pour valider";

  return (
    <Tooltip title={title}>
      <Button
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        onClick={handleClick}
        startIcon={<HeightIcon sx={{ fontSize: 18 }} />}
        size="small"
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Extruder
      </Button>
    </Tooltip>
  );
}
