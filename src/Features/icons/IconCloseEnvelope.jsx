import SvgIcon from "@mui/material/SvgIcon";

const IconCloseEnvelope = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Open outline (existing walls) */}
    <polyline
      points="5,5 5,19 19,19 19,5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Closing segment bridging the two open endpoints */}
    <line
      x1="5"
      y1="5"
      x2="19"
      y2="5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 3"
    />
  </SvgIcon>
);

export default IconCloseEnvelope;
