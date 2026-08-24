import { useDispatch, useSelector } from "react-redux";

import { setMoveBaseMapModeActive } from "Features/threedEditor/threedEditorSlice";

import { Button, Tooltip } from "@mui/material";
import OpenWithIcon from "@mui/icons-material/OpenWith";

// Entry point of the "Déplacer" (move base map) mode in the 3D bottom
// toolbar: grab a snapped point of a base map's content, the whole base map
// (image + annotations) follows the mouse, a second click drops it.
export default function ButtonMoveBaseMapThreed() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.moveBaseMapMode.active);

  return (
    <Tooltip title="Déplacer un fond de plan à partir d'un point">
      <Button
        size="small"
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        startIcon={<OpenWithIcon sx={{ fontSize: 18 }} />}
        onClick={() => dispatch(setMoveBaseMapModeActive(!active))}
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Déplacer
      </Button>
    </Tooltip>
  );
}
