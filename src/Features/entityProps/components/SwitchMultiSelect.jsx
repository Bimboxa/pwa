import {useSelector, useDispatch} from "react-redux";

import {setMultiSelect} from "../entityPropsSlice";

import {FormControlLabel, Switch, Typography, Box} from "@mui/material";

export default function SwitchMultiSelect() {
  const dispatch = useDispatch();

  // strings

  const label = "Sélection multiple";

  // data

  const multiSelect = useSelector((s) => s.entityProps.multiSelect);

  // handlers

  function handleChange(e, checked) {
    dispatch(setMultiSelect(checked));
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
