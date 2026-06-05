import SvgIcon from "@mui/material/SvgIcon";

const IconStripSegment = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Band area (offset from the single centerline segment) */}
    <path d="M4 13 L18 13 L18 8 L4 8 Z" fill="currentColor" fillOpacity={0.2} />
    {/* Centerline (the single segment the user draws) */}
    <line
      x1="4"
      y1="13"
      x2="18"
      y2="13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Top edge of band (dashed) */}
    <line
      x1="4"
      y1="8"
      x2="18"
      y2="8"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeDasharray="2 2"
      opacity={0.5}
    />
    {/* Start point (filled) */}
    <circle cx="4" cy="13" r="2.5" fill="currentColor" />
    {/* End point (filled) */}
    <circle cx="18" cy="13" r="2.5" fill="currentColor" />
  </SvgIcon>
);

export default IconStripSegment;
