import { Box, Typography } from "@mui/material";

export default function PortfolioEditorViewport() {
  // render

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#E0E0E0",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Portfolio editor viewport
      </Typography>
    </Box>
  );
}
