import {Box, FormControlLabel, Switch, Typography} from "@mui/material";

export default function SwitchGeneric({checked, onChange, label}) {
  function handleChange(e, checked) {
    onChange(checked);
  }
  return (
    <Box sx={{pl: 1}}>
      <FormControlLabel
        control={
          <Switch size="small" onChange={handleChange} checked={checked} />
        }
        label={<Typography variant="caption">{label}</Typography>}
      />
    </Box>
  );
}
