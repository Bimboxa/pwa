import SvgIcon from "@mui/material/SvgIcon";

// « Découpe verticale » (FACE_CUT_VERTICAL, 3D): a face seen head-on, split
// in two tones by a vertical dashed cut overshooting top and bottom.
const IconFaceCutVertical = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points="4,5 12,5 12,19 4,19"
      fill="currentColor"
      fillOpacity="0.4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <polygon
      points="12,5 20,5 20,19 12,19"
      fill="currentColor"
      fillOpacity="0.15"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <line
      x1="12"
      y1="2.5"
      x2="12"
      y2="21.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2"
    />
  </SvgIcon>
);

export default IconFaceCutVertical;
