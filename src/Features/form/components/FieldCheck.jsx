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
  const showAsSection = options?.showAsSection ?? false;
  const textColor = options?.textColor ?? "text.primary";

  function handleChange(e, checked) {
    onChange(checked);
  }
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        p: 1,
        ...(showAsSection && {
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }),
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
        label={<Typography variant="body2" color={textColor}>{label}</Typography>}
      />
    </Box>
  );
}
