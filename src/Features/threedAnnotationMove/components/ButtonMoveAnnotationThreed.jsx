import { useDispatch, useSelector } from "react-redux";

import { setMoveAnnotationModeActive } from "Features/threedEditor/threedEditorSlice";

import { Button, Tooltip } from "@mui/material";
import OpenWithIcon from "@mui/icons-material/OpenWith";

import ToolbarHotkeyBadge from "Features/threedDrawing/components/ToolbarHotkeyBadge";

// Entry point of the "Déplacer" (move annotation) mode in the 3D bottom
// toolbar of the Dessin (MAP) module: grab a snapped point of an annotation,
// the selected annotations follow the mouse as one group, a second click
// drops and writes the new 2D coordinates back.
export default function ButtonMoveAnnotationThreed({ hotkey }) {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.moveAnnotationMode.active);

  return (
    <Tooltip title="Déplacer une annotation à partir d'un point">
      <Button
        size="small"
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        startIcon={<OpenWithIcon sx={{ fontSize: 18 }} />}
        onClick={() => dispatch(setMoveAnnotationModeActive(!active))}
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Déplacer
        <ToolbarHotkeyBadge hotkey={hotkey} />
      </Button>
    </Tooltip>
  );
}
