import {useSelector, useDispatch} from "react-redux";

import {setMultiSelect, setSelection} from "../entityPropsSlice";

import {FormControlLabel, Switch, Typography, Box} from "@mui/material";

export default function SwitchMultiSelect() {
  const dispatch = useDispatch();

  // strings

  const label = "Sélection multiple";

  // data

  const multiSelect = useSelector((s) => s.entityProps.multiSelect);
  const selection = useSelector((s) => s.entityProps.selection);

  // handlers

  function handleChange(e, checked) {
    dispatch(setMultiSelect(checked));
    if (!checked) {
      if (selection?.length > 1) {
        dispatch(setSelection([selection[0]]));
      }
    }
  }

  return (
    <Box sx={{pl: 1}}>
      <FormControlLabel
        control={
          <Switch size="small" onChange={handleChange} checked={multiSelect} />
        }
        label={<Typography variant="caption">{label}</Typography>}
      />
    </Box>
  );
}
