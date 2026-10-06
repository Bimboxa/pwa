import SvgIcon from "@mui/material/SvgIcon";

// « Découpe verticale » (Coupe face, 3D): a face cut by a vertical line.
const IconFaceCutVertical = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points="4,6 12,3 20,6 20,18 12,21 4,18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      opacity="0.6"
    />
    <line
      x1="12"
      y1="2"
      x2="12"
      y2="22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="4 2"
    />
  </SvgIcon>
);

export default IconFaceCutVertical;
