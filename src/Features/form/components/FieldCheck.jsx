import {
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Switch,
} from "@mui/material";

import SelectorIconGeneric from "Features/layout/components/SelectorIconGeneric";

export default function FieldCheck({ value, onChange, label, options }) {
  const type = options?.type ?? "check";

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
        sx={{ pl: 1 }}
        control={
          type === "switch" ? (
            <Switch
              size="small"
              checked={Boolean(value)}
              onChange={handleChange}
            />
          ) : (
            <Checkbox
              size="small"
              checked={Boolean(value)}
              onChange={handleChange}
            />
          )
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
    </Box>
  );
}
