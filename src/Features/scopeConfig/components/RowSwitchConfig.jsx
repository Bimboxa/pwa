import { Box, Switch, Typography } from "@mui/material";

// Generic switch row of the Configuration pages: optional icon + label
// (+ optional caption under it) on the left, switch on the right.
export default function RowSwitchConfig({
  icon,
  label,
  caption,
  checked,
  disabled,
  onChange,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 0.5,
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {icon && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              color: "text.secondary",
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
      <Switch
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </Box>
  );
}
