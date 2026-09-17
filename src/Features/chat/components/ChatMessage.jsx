import { Box } from "@mui/material";

import { CHAT_COLORS } from "../chatDarkTheme";
import ChatImageThumbs from "./ChatImageThumbs";
import ChatText from "./ChatText";

// User messages sit in a bubble on the right; what the assistant says is
// plain text on the panel, full width.
export default function ChatMessage({ role, content, images }) {
  const isUser = role === "user";

  if (!isUser) return <ChatText text={content} />;

  return (
    <Box display="flex" justifyContent="flex-end">
      <Box
        sx={{
          px: 1.5,
          py: 1,
          maxWidth: "85%",
          backgroundColor: CHAT_COLORS.surfaceRaised,
          color: "text.primary",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        <ChatImageThumbs images={images} size={72} />
        <ChatText text={content} />
      </Box>
    </Box>
  );
}
