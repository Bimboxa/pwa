import { useDispatch, useSelector } from "react-redux";

import { setHideMeshes3d } from "Features/threedEditor/threedEditorSlice";

import { FormControlLabel, Switch, Typography } from "@mui/material";

// "Masquer les mailles" switch of the Maillage module (mailles drawer and
// "Maillage" side of the annotations popper): hides every maille in the 3D
// editor so the annotations under them show (threedEditor.hideMeshes3d,
// read by ThreedMeshes). The list keeps its rows.
export default function SwitchMesh3dHideMeshes() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Masquer les mailles";

  // data

  const hideMeshes3d = useSelector((s) => s.threedEditor.hideMeshes3d);

  // render

  return (
    <FormControlLabel
      sx={{ ml: 0 }}
      control={
        <Switch
          size="small"
          checked={hideMeshes3d}
          onChange={(e) => dispatch(setHideMeshes3d(e.target.checked))}
        />
      }
      label={
        <Typography variant="body2" sx={{ ml: 0.5 }}>
          {labelS}
        </Typography>
      }
    />
  );
}
