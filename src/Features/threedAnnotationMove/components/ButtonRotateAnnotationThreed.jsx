import { useDispatch, useSelector } from "react-redux";

import { setRotateAnnotationModeActive } from "Features/threedEditor/threedEditorSlice";

import { Button, Tooltip } from "@mui/material";
import RotateRightIcon from "@mui/icons-material/RotateRight";

import ToolbarHotkeyBadge from "Features/threedDrawing/components/ToolbarHotkeyBadge";

// Entry point of the "Tourner" (rotate annotation) mode in the 3D bottom
// toolbar of the Dessin (MAP) module: pick the rotation pivot on an
// annotation, the selected annotations then rotate around the base map
// plane's normal through the pivot, a third click commits the new 2D
// coordinates.
export default function ButtonRotateAnnotationThreed({ hotkey }) {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.rotateAnnotationMode.active);

  return (
    <Tooltip title="Tourner une annotation autour d'un point">
      <Button
        size="small"
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        startIcon={<RotateRightIcon sx={{ fontSize: 18 }} />}
        onClick={() => dispatch(setRotateAnnotationModeActive(!active))}
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Tourner
        <ToolbarHotkeyBadge hotkey={hotkey} />
      </Button>
    </Tooltip>
  );
}
