import { useDispatch, useSelector } from "react-redux";

import { setMoveModeActive } from "Features/threedEditor/threedEditorSlice";

import OpenWithIcon from "@mui/icons-material/OpenWith";
import { Button, Tooltip } from "@mui/material";

export default function ButtonMoveThreed() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.moveMode.active);

  function handleClick() {
    dispatch(setMoveModeActive(!active));
  }

  const title = active
    ? "Quitter le mode déplacer"
    : "Déplacer — clic sur une face puis gizmo / champ pour translater";

  return (
    <Tooltip title={title}>
      <Button
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        onClick={handleClick}
        startIcon={<OpenWithIcon sx={{ fontSize: 18 }} />}
        size="small"
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Déplacer
      </Button>
    </Tooltip>
  );
}
