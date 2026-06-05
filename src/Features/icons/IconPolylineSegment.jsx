import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineSegment = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Start point (bottom-left, filled) */}
    <circle cx="5" cy="18" r="2.5" fill="currentColor" />
    {/* Single solid segment */}
    <line
      x1="6.7"
      y1="16.3"
      x2="17.3"
      y2="7.7"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* End point (top-right, filled) */}
    <circle cx="19" cy="6" r="2.5" fill="currentColor" />
  </SvgIcon>
);

export default IconPolylineSegment;
