import { SvgIcon } from "@mui/material";

export default function IconDilate(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Inner polygon (original shape) */}
      <polygon
        points="12,5 18,10 16,17 8,17 6,10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Outer polygon (offset shape, dashed) */}
      <polygon
        points="12,2 21,9 18.5,19 5.5,19 3,9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="2 1.5"
      />
      {/* Outward arrow top */}
      <line
        x1="12"
        y1="5"
        x2="12"
        y2="2.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
