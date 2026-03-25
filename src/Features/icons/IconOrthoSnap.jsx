import SvgIcon from "@mui/material/SvgIcon";

const d = 5.5; // diagonal half-length

const IconOrthoSnap = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Horizontal axis */}
    <line
      x1="3"
      y1="12"
      x2="21"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Vertical axis */}
    <line
      x1="12"
      y1="3"
      x2="12"
      y2="21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Diagonal 45° top-right */}
    <line
      x1={12 + d * Math.cos(Math.PI / 4)}
      y1={12 - d * Math.sin(Math.PI / 4)}
      x2={12 - d * Math.cos(Math.PI / 4)}
      y2={12 + d * Math.sin(Math.PI / 4)}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 2.5"
    />
    {/* Diagonal 135° top-left */}
    <line
      x1={12 - d * Math.cos(Math.PI / 4)}
      y1={12 - d * Math.sin(Math.PI / 4)}
      x2={12 + d * Math.cos(Math.PI / 4)}
      y2={12 + d * Math.sin(Math.PI / 4)}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 2.5"
    />
    {/* Center dot */}
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </SvgIcon>
);

export default IconOrthoSnap;
