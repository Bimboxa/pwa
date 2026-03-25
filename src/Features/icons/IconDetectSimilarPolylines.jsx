import SvgIcon from "@mui/material/SvgIcon";

const IconDetectSimilarPolylines = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Top horizontal line */}
    <line
      x1="3"
      y1="6"
      x2="17"
      y2="6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Bottom horizontal line */}
    <line
      x1="3"
      y1="14"
      x2="17"
      y2="14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Vertical line connecting them */}
    <line
      x1="10"
      y1="6"
      x2="10"
      y2="14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Sparkle top-right — 4-pointed star */}
    <path
      d="M20 3 L20.6 4.4 L22 5 L20.6 5.6 L20 7 L19.4 5.6 L18 5 L19.4 4.4 Z"
      fill="currentColor"
    />
    {/* Small sparkle */}
    <path
      d="M16 17 L16.4 17.9 L17.3 18.3 L16.4 18.7 L16 19.6 L15.6 18.7 L14.7 18.3 L15.6 17.9 Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export default IconDetectSimilarPolylines;
