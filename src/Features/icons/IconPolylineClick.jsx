import SvgIcon from "@mui/material/SvgIcon";

const IconPolylineClick = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Bottom-left filled point */}
    <circle cx="6" cy="19" r="2.5" fill="currentColor" />
    {/* Solid vertical line */}
    <line
      x1="6"
      y1="16.5"
      x2="6"
      y2="7.5"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Top-left filled point */}
    <circle cx="6" cy="5" r="2.5" fill="currentColor" />
    {/* Dashed horizontal line */}
    <line
      x1="8.5"
      y1="5"
      x2="16"
      y2="5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2.5"
    />
    {/* Right empty circle point */}
    <circle
      cx="19"
      cy="5"
      r="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </SvgIcon>
);

export default IconPolylineClick;
