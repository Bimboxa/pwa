import {FormControlLabel, Switch} from "@mui/material";

export default function SwitchSeeSelectionOnly({checked, onChange}) {
  return (
    <FormControlLabel
      sx={{pl: 1}}
      control={<Switch checked={checked} onChange={() => onChange(!checked)} />}
      label="Sélection uniquement"
    />
  );
}
