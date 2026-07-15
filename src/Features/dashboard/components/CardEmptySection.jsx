import { Box, Typography, Avatar } from "@mui/material";

// Dashed empty-state card used by the right-side dashboard sections
// (favorites / daily scopes). `icon` is a MUI icon element.

export default function CardEmptySection({ icon, iconColor, title, hint }) {
  return (
    <Box
      sx={{
        border: "1.5px dashed #dcdce6",
        borderRadius: 3,
        py: 6,
        px: 4,
        textAlign: "center",
        bgcolor: "white",
      }}
    >
      <Avatar
        sx={{
          width: 64,
          height: 64,
          mx: "auto",
          bgcolor: iconColor + "14",
          color: iconColor,
        }}
      >
        {icon}
      </Avatar>
      <Typography sx={{ fontWeight: 600, mt: 2.5 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
        {hint}
      </Typography>
    </Box>
  );
}
