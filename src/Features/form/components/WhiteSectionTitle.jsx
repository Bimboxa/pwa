import { Typography } from "@mui/material";

// Harmonized title for a multi-row white section: grey uppercase caption.
export default function WhiteSectionTitle({ children, sx }) {
  return (
    <Typography
      variant="caption"
      noWrap
      sx={{
        display: "block",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "text.secondary",
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
