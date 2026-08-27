import { Box } from "@mui/material";
import { TextFields } from "@mui/icons-material";

// FREE_TEXT annotation icon (lists / selectors) — the glyph reads through
// textColor: fillColor is the box BACKGROUND for this type (often white).
export default function FreeTextAnnotationIcon({ textColor, size = 24 }) {
  const iconSize = size * 0.7;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "white",
      }}
    >
      <TextFields
        sx={{
          fontSize: iconSize,
          color: textColor || "#000000",
        }}
      />
    </Box>
  );
}
