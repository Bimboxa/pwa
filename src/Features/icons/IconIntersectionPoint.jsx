import SvgIcon from "@mui/material/SvgIcon";

// « Ajouter les points d'intersection »: two segments crossing, with the
// square vertex inserted at their crossing. The segments stop at the square's
// border (no fill color, so the icon survives inverted / dark buttons).
const IconIntersectionPoint = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* First segment, bottom-left → top-right */}
    <line
      x1="3"
      y1="20"
      x2="9"
      y2="15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="15"
      y1="10"
      x2="21"
      y2="5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Second segment, top-left → bottom-right */}
    <line
      x1="4"
      y1="4"
      x2="9.2"
      y2="9.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="14.8"
      y1="15.5"
      x2="20"
      y2="21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Shared square vertex at the crossing */}
    <rect
      x="9"
      y="9.5"
      width="6"
      height="6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="miter"
    />
  </SvgIcon>
);

export default IconIntersectionPoint;
