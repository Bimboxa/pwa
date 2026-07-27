import {
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Switch,
} from "@mui/material";

import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldCheck({ value, onChange, label, options }) {
  const type = options?.type ?? "check";
  const showAsSection = options?.showAsSection ?? false;
  const showAsField = options?.showAsField ?? false;
  const showAsInline = options?.showAsInline ?? false;
  const textColor = options?.textColor ?? "text.primary";

  function handleChange(e, checked) {
    onChange(checked);
  }

  // Harmonized field row: bold label on the left, control on the right.
  if (showAsField) {
    return <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          width: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }} color={textColor}>
          {label}
        </Typography>
        {type === "switch" ? (
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
        )}
      </Box>
    </WhiteSectionGeneric>
  }

  if (showAsSection) {
    return <WhiteSectionGeneric>
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
    </WhiteSectionGeneric>
  }
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        ...(showAsInline ? { px: 1, py: 0 } : { p: 1 }),
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
