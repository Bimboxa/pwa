import { createElement } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";

import theme from "Styles/theme";

export default function IconButtonAction({
  icon,
  label,
  onClick,
  disabled,
  bgcolor,
}) {
  // Calculate best contrast color for the icon
  const color = bgcolor
    ? theme.palette.getContrastText(bgcolor)
    : "theme.palette.text.secondary";

  return (
    <Box
      sx={{
        bgcolor,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Tooltip title={label}>
        <IconButton
          key={label}
          onClick={onClick}
          disabled={disabled}
          sx={{ color }}
        >
          {createElement(icon, { color: "inherit" })}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
