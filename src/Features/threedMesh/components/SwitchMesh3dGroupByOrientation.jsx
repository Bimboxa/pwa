import { useDispatch, useSelector } from "react-redux";

import { setMesh3dGroupByOrientation } from "Features/threedEditor/threedEditorSlice";

import { FormControlLabel, Switch, Typography } from "@mui/material";

// "Grouper par orientation" switch of the mailles list (mailles drawer and
// "Maillage" side of the annotations popper).
export default function SwitchMesh3dGroupByOrientation() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Grouper par orientation";

  // data

  const groupByOrientation = useSelector(
    (s) => s.threedEditor.mesh3dGroupByOrientation
  );

  // render

  return (
    <FormControlLabel
      sx={{ ml: 0 }}
      control={
        <Switch
          size="small"
          checked={groupByOrientation}
          onChange={(e) =>
            dispatch(setMesh3dGroupByOrientation(e.target.checked))
          }
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
