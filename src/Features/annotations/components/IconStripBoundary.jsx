import { SvgIcon } from "@mui/material";

export default function IconStripBoundary(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Outer contour (dashed) representing the boundary */}
      <path
        d="M4 4 L14 4 L20 10 L20 20 L10 20 L4 14 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="3 2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Inner strip shape (solid, smaller) */}
      <path
        d="M7 7 L13 7 L17 11 L17 17 L13 17 L7 11 Z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
