import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineRectangle = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Dashed rectangle outline */}
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Top-left filled point (first click) */}
    <circle cx="3" cy="3" r="2.5" fill="currentColor" />
    {/* Bottom-right empty point (second click) */}
    <circle
      cx="21"
      cy="21"
      r="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </SvgIcon>
);

export default IconPolylineRectangle;
