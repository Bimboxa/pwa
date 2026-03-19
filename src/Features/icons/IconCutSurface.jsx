import SvgIcon from "@mui/material/SvgIcon";

const IconCutSurface = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Polygon outline */}
    <polygon
      points="4,7 12,3 20,7 20,17 12,21 4,17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      opacity="0.5"
    />

    {/* Cutting blade line */}
    <line
      x1="3"
      y1="15"
      x2="21"
      y2="9"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />

    {/* Top half fill hint */}
    <polygon
      points="4,7 12,3 20,7 20,10.5 3,14"
      fill="currentColor"
      opacity="0.08"
    />
  </SvgIcon>
);

export default IconCutSurface;
