import { Box, ToggleButtonGroup, ToggleButton } from "@mui/material";

export default function ToggleSingleSelectorGeneric({
  options,
  selectedKey,
  onChange,
  disabled,
}) {
  function handleChange(e, v) {
    console.log("handleChange", v);
    onChange(v === selectedKey ? null : v);
  }
  return (
    <Box sx={{ display: "flex", width: 1, justifyContent: "center" }}>
      <ToggleButtonGroup
        onChange={handleChange}
        value={selectedKey}
        exclusive
        disabled={disabled}
      >
        {options.map(({ key, label, icon }) => {
          return (
            <ToggleButton key={key} value={key} size="small">
              {icon ?? label}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
}
