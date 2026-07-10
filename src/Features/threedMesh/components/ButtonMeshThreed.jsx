import { useDispatch } from "react-redux";

import { setMeshingModeActive } from "Features/threedEditor/threedEditorSlice";

import GridOnIcon from "@mui/icons-material/GridOn";
import { Button, Tooltip } from "@mui/material";

// "Mailler" button of the bottom 3D toolbar: enters meshing mode (the whole
// toolbar is then replaced by MeshingToolbarThreed).
export default function ButtonMeshThreed() {
  const dispatch = useDispatch();

  function handleClick() {
    dispatch(setMeshingModeActive(true));
  }

  return (
    <Tooltip title="Mailler — cliquez sur une face pour créer une maille, puis découpez-la">
      <Button
        variant="outlined"
        color="inherit"
        onClick={handleClick}
        startIcon={<GridOnIcon sx={{ fontSize: 18 }} />}
        size="small"
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Mailler
      </Button>
    </Tooltip>
  );
}
