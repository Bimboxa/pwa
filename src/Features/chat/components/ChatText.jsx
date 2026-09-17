import { Box, Typography } from "@mui/material";

import { CHAT_COLORS, CHAT_FONT } from "../chatDarkTheme";

// The model writes light markdown: **bold** and `code` are rendered, the rest
// stays plain text (line breaks kept).
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

export default function ChatText({ text, variant = "body1", color, sx }) {
  const parts = String(text ?? "").split(INLINE);

  return (
    <Typography
      variant={variant}
      color={color}
      sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere", ...sx }}
    >
      {parts.map((part, i) => {
        if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
          return (
            <Box key={i} component="strong" sx={{ fontWeight: 600 }}>
              {part.slice(2, -2)}
            </Box>
          );
        }
        if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
          return (
            <Box
              key={i}
              component="code"
              sx={{
                fontFamily: CHAT_FONT.mono,
                fontSize: "0.86em",
                color: CHAT_COLORS.code,
                border: `1px solid ${CHAT_COLORS.borderStrong}`,
                borderRadius: "4px",
                px: "4px",
                py: "1px",
              }}
            >
              {part.slice(1, -1)}
            </Box>
          );
        }
        return part;
      })}
    </Typography>
  );
}
