import SvgIcon from "@mui/material/SvgIcon";

const IconStrip = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Band area (offset from centerline) */}
    <path
      d="M3 7 L14 7 L21 14 L21 18 L14 11 L3 11 Z"
      fill="currentColor"
      fillOpacity={0.2}
    />
    {/* Centerline (the line the user draws) */}
    <line
      x1="3"
      y1="11"
      x2="14"
      y2="11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="14"
      y1="11"
      x2="21"
      y2="18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Top edge of band (dashed) */}
    <line
      x1="3"
      y1="7"
      x2="14"
      y2="7"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeDasharray="2 2"
      opacity={0.5}
    />
    <line
      x1="14"
      y1="7"
      x2="21"
      y2="14"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeDasharray="2 2"
      opacity={0.5}
    />
  </SvgIcon>
);

export default IconStrip;
