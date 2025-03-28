import {Box, Typography, Paper} from "@mui/material";

export default function ChatMessage({role, content}) {
  const isUser = role === "user";

  return (
    <Box display="flex" justifyContent={isUser ? "flex-end" : "flex-start"}>
      <Paper
        sx={{
          p: 1.5,
          maxWidth: "75%",
          backgroundColor: isUser ? "#1976d2" : "#e0e0e0",
          color: isUser ? "white" : "black",
          borderRadius: 2,
        }}
      >
        <Typography variant="body1">{content}</Typography>
      </Paper>
    </Box>
  );
}
