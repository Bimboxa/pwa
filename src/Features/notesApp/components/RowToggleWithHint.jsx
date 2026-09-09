import { Box, Switch, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// Krnet "toggle row": label + switch on the right, optional hint below.
export default function RowToggleWithHint({
  label,
  hint,
  checked,
  onChange,
  disabled,
}) {
  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          width: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
        <Switch
          size="small"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </Box>
      {hint && (
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary", mt: 0.5 }}
        >
          {hint}
        </Typography>
      )}
    </WhiteSectionGeneric>
  );
}
