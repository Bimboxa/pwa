import { SvgIcon } from "@mui/material";

export default function IconReentrantAngle(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Polygon edge left */}
      <line
        x1="4"
        y1="20"
        x2="10"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Polygon edge right */}
      <line
        x1="10"
        y1="8"
        x2="20"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Polygon fill hint */}
      <polygon
        points="4,20 10,8 20,16"
        fill="currentColor"
        opacity="0.1"
      />
      {/* Reentrant polyline segments (dashed) */}
      <line
        x1="3"
        y1="10"
        x2="10"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 1.5"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="8"
        x2="15"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 1.5"
        strokeLinecap="round"
      />
      {/* Point marker at reentrant vertex */}
      <circle cx="10" cy="8" r="2.5" fill="currentColor" />
    </SvgIcon>
  );
}
