import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineCircleRadius = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Circle outline */}
    <circle
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    {/* Center point */}
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    {/* Radius line from center to the circle */}
    <line
      x1="12"
      y1="12"
      x2="21"
      y2="12"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </SvgIcon>
);

export default IconPolylineCircleRadius;
