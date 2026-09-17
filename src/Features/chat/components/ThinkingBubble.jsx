import { CircularProgress, Box, Paper } from "@mui/material";

export default function ThinkingBubble() {
  return (
    <Box display="flex" justifyContent="flex-start">
      <Paper
        sx={{
          p: 1.5,
          display: "flex",
          alignItems: "center",
          backgroundColor: "background.paper",
          backgroundImage: "none",
          boxShadow: "none",
          borderRadius: 2,
        }}
      >
        <CircularProgress size={20} />
      </Paper>
    </Box>
  );
}
