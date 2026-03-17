import { SvgIcon } from "@mui/material";

export default function IconAnchorSnap(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Horizontal segment (target) */}
      <line
        x1="4"
        y1="18"
        x2="20"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Vertical projection line (dashed) */}
      <line
        x1="12"
        y1="6"
        x2="12"
        y2="18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        strokeLinecap="round"
      />
      {/* Source point */}
      <circle cx="12" cy="6" r="2.5" fill="currentColor" />
      {/* Projected point on segment */}
      <circle cx="12" cy="18" r="2" fill="currentColor" />
    </SvgIcon>
  );
}
