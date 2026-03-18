import SvgIcon from "@mui/material/SvgIcon";

const IconSegmentSplit = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Main vertical segment (wall) */}
    <line
      x1="12"
      y1="3"
      x2="12"
      y2="21"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Top point */}
    <circle cx="12" cy="3" r="2" fill="currentColor" />
    {/* Bottom point */}
    <circle cx="12" cy="21" r="2" fill="currentColor" />
    {/* Split mark - short horizontal tick at 1m from junction */}
    <line
      x1="9.5"
      y1="8"
      x2="14.5"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Perpendicular wall (connected polyline) going right */}
    <line
      x1="12"
      y1="3"
      x2="21"
      y2="3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2.5"
    />
    {/* Small "1m" return portion highlighted differently */}
    <line
      x1="12"
      y1="3"
      x2="12"
      y2="8"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      opacity="0.4"
    />
  </SvgIcon>
);

export default IconSegmentSplit;
