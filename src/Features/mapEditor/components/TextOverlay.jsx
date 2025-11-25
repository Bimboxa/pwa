import { Box, Typography, Paper } from "@mui/material";

export default function TextOverlay({ text, anchor }) {
  if (!text || text.trim() === "") return null;

  const sxProps = anchor
    ? {
        position: "absolute",
        top: 8,
        left: 8,
        pointerEvents: "none",
        maxWidth: 180,
        bgcolor: "rgba(255,255,255,0.9)",
        boxShadow: 3,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        zIndex: 1100,
      }
    : {
        position: "fixed",
        top: 16,
        right: 16,
        p: 1.5,
        maxWidth: 300,
        bgcolor: "background.paper",
        boxShadow: 3,
        pointerEvents: "none",
        zIndex: 2000,
      };

  return (
    <Paper sx={sxProps}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: "bold",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </Typography>
    </Paper>
  );
}
