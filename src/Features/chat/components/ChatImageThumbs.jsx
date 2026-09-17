import { Box, IconButton } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import { CHAT_COLORS } from "../chatDarkTheme";

// Pictures attached to a message: waiting above the input (`onRemove`), or
// shown in the user's bubble once sent. images: [{ id?, name, thumbUrl }].
export default function ChatImageThumbs({ images, onRemove, size = 56 }) {
  // strings

  const removeS = "Retirer l'image";

  if (!images?.length) return null;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {images.map((image, i) => (
        <Box
          key={image.id ?? i}
          sx={{ position: "relative", width: size, height: size }}
        >
          <Box
            component="img"
            src={image.thumbUrl}
            alt={image.name ?? ""}
            title={image.name ?? ""}
            sx={{
              width: 1,
              height: 1,
              display: "block",
              objectFit: "cover",
              borderRadius: "8px",
              border: `1px solid ${CHAT_COLORS.borderStrong}`,
              backgroundColor: "#fff",
            }}
          />
          {onRemove ? (
            <IconButton
              size="small"
              aria-label={`${removeS} ${image.name ?? ""}`}
              onClick={() => onRemove(image.id)}
              sx={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 18,
                height: 18,
                p: 0,
                color: CHAT_COLORS.text,
                backgroundColor: CHAT_COLORS.surfaceRaised,
                border: `1px solid ${CHAT_COLORS.borderStrong}`,
                "&:hover": { backgroundColor: "#3a3a3a" },
              }}
            >
              <CloseIcon sx={{ fontSize: 12 }} />
            </IconButton>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
