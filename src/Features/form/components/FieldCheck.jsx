import { Box, Typography, FormControlLabel, Checkbox } from "@mui/material";

import SelectorIconGeneric from "Features/layout/components/SelectorIconGeneric";

export default function FieldCheck({ value, onChange, label }) {
  function handleChange(e, checked) {
    onChange(checked);
  }
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        p: 1,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <FormControlLabel
        control={<Checkbox checked={Boolean(value)} onChange={handleChange} />}
        label={<Typography>{label}</Typography>}
      />
    </Box>
  );
}
