import SvgIcon from "@mui/material/SvgIcon";

const IconSplitPolygon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Polygon outline */}
    <polygon
      points="4,6 12,3 20,6 20,18 12,21 4,18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      opacity="0.6"
    />

    {/* Cutting line through polygon */}
    <line
      x1="2"
      y1="16"
      x2="22"
      y2="8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="4 2"
    />
  </SvgIcon>
);

export default IconSplitPolygon;
