import SvgIcon from "@mui/material/SvgIcon";

// « Coupe face — Rectangle » (FACE_CUT_RECTANGLE, 3D): a face seen head-on
// with the rectangular piece cut out of it (dashed outline, darker fill). No
// click markers: the rectangle inside the face is the whole message.
const IconFaceCutRectangle = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points="4,5 20,5 20,19 4,19"
      fill="currentColor"
      fillOpacity="0.18"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <rect
      x="8"
      y="9"
      width="8"
      height="6"
      fill="currentColor"
      fillOpacity="0.45"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeDasharray="3 2"
    />
  </SvgIcon>
);

export default IconFaceCutRectangle;
