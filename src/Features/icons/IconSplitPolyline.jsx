import SvgIcon from "@mui/material/SvgIcon";

const IconSplitPolyline = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Left piece of polyline */}
    <polyline
      points="3,18 7,10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Right piece of polyline */}
    <polyline
      points="17,8 21,4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Removed middle section (dashed) */}
    <line
      x1="7"
      y1="10"
      x2="17"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 2"
      opacity="0.3"
    />

    {/* Cut point 1 marker */}
    <circle cx="7" cy="10" r="2.5" fill="currentColor" />

    {/* Cut point 2 marker */}
    <circle cx="17" cy="8" r="2.5" fill="currentColor" />
  </SvgIcon>
);

export default IconSplitPolyline;
