import { useSelector } from "react-redux";

import { selectImagesConnector } from "../popperImagesSlice";

import { Box } from "@mui/material";

import {
  IMAGE_BADGE_CORNER_PX,
  IMAGE_BADGE_FONT_PX,
  IMAGE_BADGE_HEIGHT_PX,
  IMAGE_BADGE_WIDTH_PX,
} from "../constants/imageDisplay";

// DOM numbered badge of a photo (tiles): rounded rectangle, filled with the
// global connector colour of the photos.
export default function ImageIndexBadge({ number, dimmed = false, sx }) {
  const connectorColor = useSelector(selectImagesConnector).color;
  if (number == null) return null;
  return (
    <Box
      sx={(theme) => ({
        minWidth: IMAGE_BADGE_WIDTH_PX,
        height: IMAGE_BADGE_HEIGHT_PX,
        px: "4px",
        borderRadius: `${IMAGE_BADGE_CORNER_PX}px`,
        bgcolor: connectorColor,
        color: theme.palette.getContrastText(connectorColor),
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
      })}
    >
      {number}
    </Box>
  );
}
