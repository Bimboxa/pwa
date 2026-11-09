import { Box } from "@mui/material";

import {
  IMAGE_BADGE_BG,
  IMAGE_BADGE_FG,
  IMAGE_BADGE_FONT_PX,
  IMAGE_BADGE_RADIUS_PX,
} from "../constants/imageDisplay";

// DOM numbered badge of a photo (PopperImages tiles).
export default function ImageIndexBadge({ number, dimmed = false, sx }) {
  if (number == null) return null;
  const size = IMAGE_BADGE_RADIUS_PX * 2;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: IMAGE_BADGE_BG,
        color: IMAGE_BADGE_FG,
        border: "1.5px solid #fff",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: IMAGE_BADGE_FONT_PX,
        fontWeight: 600,
        lineHeight: 1,
        opacity: dimmed ? 0.3 : 1,
        pointerEvents: "none",
        userSelect: "none",
        ...sx,
      }}
    >
      {number}
    </Box>
  );
}
