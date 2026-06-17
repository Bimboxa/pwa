import { useDispatch, useSelector } from "react-redux";

import { setDimensionModeActive } from "Features/threedEditor/threedEditorSlice";

import StraightenIcon from "@mui/icons-material/Straighten";
import { Button, Tooltip } from "@mui/material";

export default function ButtonDimensionThreed() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.dimensionMode.active);

  function handleClick() {
    dispatch(setDimensionModeActive(!active));
  }

  const title = active
    ? "Quitter le mode cotation (Échap pour annuler)"
    : "Coter — clic sur 2 points accrochés aux mesh (sommets / segments)";

  return (
    <Tooltip title={title}>
      <Button
        variant={active ? "contained" : "outlined"}
        color={active ? "secondary" : "inherit"}
        onClick={handleClick}
        startIcon={<StraightenIcon sx={{ fontSize: 18 }} />}
        size="small"
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Coter
      </Button>
    </Tooltip>
  );
}
