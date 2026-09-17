import { Box, Typography, Paper } from "@mui/material";

export default function ChatMessage({ role, content }) {
  const isUser = role === "user";

  return (
    <Box display="flex" justifyContent={isUser ? "flex-end" : "flex-start"}>
      <Paper
        sx={{
          p: 1.5,
          maxWidth: "75%",
          backgroundColor: isUser ? "#2b2b2b" : "background.paper",
          backgroundImage: "none",
          boxShadow: "none",
          color: "text.primary",
          borderRadius: 2,
        }}
      >
        <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
          {content}
        </Typography>
      </Paper>
    </Box>
  );
}
