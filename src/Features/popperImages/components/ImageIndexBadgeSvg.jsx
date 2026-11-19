import theme from "Styles/theme";

import {
  IMAGE_BADGE_BG,
  IMAGE_BADGE_FG,
  IMAGE_BADGE_CORNER_PX,
  IMAGE_BADGE_FONT_PX,
  IMAGE_BADGE_HEIGHT_PX,
  IMAGE_BADGE_WIDTH_PX,
} from "../constants/imageDisplay";

// SVG numbered badge of a photo (rounded rectangle; `stroke` / `strokeWidth` override the
// white ring, e.g. selected; `fill` = connector colour of the photo, the
// text takes its contrast colour), centred on (0,0) in SCREEN pixels: the
// caller wraps it in its inverse-zoom group (NodeImageStatic) or draws it in
// an overlay already in screen pixels (CaptureImagesOverlay).
export default function ImageIndexBadgeSvg({
  number,
  dimmed = false,
  stroke = "#fff",
  strokeWidth = 1.5,
  fill,
}) {
  if (number == null) return null;
  // Manual numbers are free text (up to 4 characters): shrink to fit.
  const fontSize =
    String(number).length > 3
      ? IMAGE_BADGE_FONT_PX - 3
      : String(number).length > 2
        ? IMAGE_BADGE_FONT_PX - 1.5
        : IMAGE_BADGE_FONT_PX;
  return (
    <g style={{ pointerEvents: "none", opacity: dimmed ? 0.3 : 1 }}>
      <rect
        x={-IMAGE_BADGE_WIDTH_PX / 2}
        y={-IMAGE_BADGE_HEIGHT_PX / 2}
        width={IMAGE_BADGE_WIDTH_PX}
        height={IMAGE_BADGE_HEIGHT_PX}
        rx={IMAGE_BADGE_CORNER_PX}
        fill={fill || IMAGE_BADGE_BG}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <text
        y={IMAGE_BADGE_FONT_PX * 0.36}
        textAnchor="middle"
        fill={fill ? theme.palette.getContrastText(fill) : IMAGE_BADGE_FG}
        fontSize={fontSize}
        fontWeight={600}
        fontFamily={theme.typography?.fontFamily}
      >
        {number}
      </text>
    </g>
  );
}
