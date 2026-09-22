import { Box, MenuItem, Select, Typography } from "@mui/material";

// Generic select row of the Configuration pages: optional icon + label
// (+ optional caption under it) on the left, a small select on the right.
// Same layout as RowSwitchConfig, with a `{key, label}[]` options list.
export default function RowSelectConfig({
  icon,
  label,
  caption,
  value,
  options = [],
  disabled,
  onChange,
}) {
  // helpers

  const hasValue = options.some((o) => o.key === value);

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 0.5,
        px: 1,
        gap: 2,
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}
      >
        {icon && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              color: "text.secondary",
              "& svg": { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2">{label}</Typography>
          {caption && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block" }}
            >
              {caption}
            </Typography>
          )}
        </Box>
      </Box>
      <Select
        size="small"
        value={hasValue ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        sx={{ minWidth: 180, flexShrink: 0 }}
      >
        {options.map((option) => (
          <MenuItem key={option.key} value={option.key}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
