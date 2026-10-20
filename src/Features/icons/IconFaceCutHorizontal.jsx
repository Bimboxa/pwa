import SvgIcon from "@mui/material/SvgIcon";

// « Découpe horizontale » (FACE_CUT_HORIZONTAL, 3D): a face seen head-on,
// split in two tones by a horizontal dashed cut overshooting both sides.
const IconFaceCutHorizontal = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points="4,5 20,5 20,12 4,12"
      fill="currentColor"
      fillOpacity="0.15"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <polygon
      points="4,12 20,12 20,19 4,19"
      fill="currentColor"
      fillOpacity="0.4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <line
      x1="1.5"
      y1="12"
      x2="22.5"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2"
    />
  </SvgIcon>
);

export default IconFaceCutHorizontal;
