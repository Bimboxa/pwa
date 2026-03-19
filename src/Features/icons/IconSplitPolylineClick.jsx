import SvgIcon from "@mui/material/SvgIcon";

const IconSplitPolylineClick = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Left piece of polyline */}
    <polyline
      points="3,18 8,10 12,12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Right piece of polyline */}
    <polyline
      points="12,12 16,8 21,4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Split point marker (click target) */}
    <circle cx="12" cy="12" r="3" fill="currentColor" />

    {/* Small gap indicators */}
    <line
      x1="10.5"
      y1="14"
      x2="9"
      y2="16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.4"
    />
    <line
      x1="13.5"
      y1="10"
      x2="15"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.4"
    />
  </SvgIcon>
);

export default IconSplitPolylineClick;
