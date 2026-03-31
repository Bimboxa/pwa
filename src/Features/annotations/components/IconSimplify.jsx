import { SvgIcon } from "@mui/material";

export default function IconSimplify(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Jagged polygon (original) */}
      <polyline
        points="4,18 6,12 5,9 8,6 10,8 12,4 14,8 16,6 19,9 18,12 20,18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Simplified polygon (fewer vertices, dashed) */}
      <polyline
        points="4,18 6,9 12,4 19,9 20,18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Base line */}
      <line
        x1="4"
        y1="18"
        x2="20"
        y2="18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
