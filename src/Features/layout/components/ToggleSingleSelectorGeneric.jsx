import {Box, ToggleButtonGroup, ToggleButton} from "@mui/material";

export default function ToggleSingleSelectorGeneric({
  options,
  selectedKey,
  onChange,
}) {
  function handleChange(e, v) {
    if (v) {
      onChange(v);
    }
  }
  return (
    <Box sx={{display: "flex", width: 1, justifyContent: "center"}}>
      <ToggleButtonGroup onChange={handleChange} value={selectedKey} exclusive>
        {options.map(({key, label}) => {
          return (
            <ToggleButton key={key} value={key}>
              {label}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
}
