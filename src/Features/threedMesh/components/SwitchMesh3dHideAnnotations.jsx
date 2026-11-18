import { useDispatch, useSelector } from "react-redux";

import { setHideAnnotationsIn3d } from "Features/threedEditor/threedEditorSlice";

import { FormControlLabel, Switch, Typography } from "@mui/material";

// "Masquer les annotations" switch of the Maillage module (mailles drawer
// and "Maillage" side of the annotations popper): hides the annotations in
// the 3D editor so only the mailles show (threedEditor.hideAnnotationsIn3d —
// same state as the switch of the module settings card).
export default function SwitchMesh3dHideAnnotations() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Masquer les annotations";

  // data

  const hideAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );

  // render

  return (
    <FormControlLabel
      sx={{ ml: 0 }}
      control={
        <Switch
          size="small"
          checked={hideAnnotationsIn3d}
          onChange={(e) => dispatch(setHideAnnotationsIn3d(e.target.checked))}
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
