import SvgIcon from "@mui/material/SvgIcon";

// Horizontal segment with a small 4-branch sparkle at the top-right corner
// (sparkle style borrowed from MUI AutoFixHigh). Used by the SEGMENT_DETECTION
// drawing tool to signal "detect a POLYLINE on the median axis of a wall".

const IconSegmentDetection = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Horizontal segment (the detected centerline) */}
    <line
      x1="3"
      y1="16"
      x2="17"
      y2="16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* End-point markers on the segment */}
    <circle cx="3" cy="16" r="1.4" fill="currentColor" />
    <circle cx="17" cy="16" r="1.4" fill="currentColor" />
    {/* 4-branch sparkle (top-right), centered at (19, 6) */}
    <path
      d="M19 2 L20 5 L23 6 L20 7 L19 10 L18 7 L15 6 L18 5 Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export default IconSegmentDetection;
