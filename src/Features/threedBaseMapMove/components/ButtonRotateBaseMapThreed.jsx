import { useDispatch, useSelector } from "react-redux";

import { setRotateBaseMapModeActive } from "Features/threedEditor/threedEditorSlice";

import { Button, Tooltip } from "@mui/material";
import RotateRightIcon from "@mui/icons-material/RotateRight";

// Entry point of the "Tourner" (rotate base map) mode in the 3D bottom
// toolbar: pick the rotation pivot on a base map's content, the whole base
// map (image + annotations) then rotates around the world-vertical axis
// through the pivot, a second click commits the angle.
export default function ButtonRotateBaseMapThreed() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.rotateBaseMapMode.active);

  return (
    <Tooltip title="Tourner un fond de plan autour d'un point">
      <Button
        size="small"
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        startIcon={<RotateRightIcon sx={{ fontSize: 18 }} />}
        onClick={() => dispatch(setRotateBaseMapModeActive(!active))}
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Tourner
      </Button>
    </Tooltip>
  );
}
