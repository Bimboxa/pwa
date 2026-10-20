import SvgIcon from "@mui/material/SvgIcon";

// « Coupe face » (FACE_CUT group, 3D): a face seen head-on, already split in
// two along a diagonal cut and pulled apart, with the dashed cutting stroke
// overshooting the face at both ends. The toolbar button usually shows the
// active variant instead (IconFaceCutSegment…); this one is the group icon.
const IconFaceCut = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* upper piece, shifted away from the cut */}
    <polygon
      points="4,5 20,5 20,7.2 4,16.8"
      fill="currentColor"
      fillOpacity="0.2"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      transform="translate(-0.5,-0.9)"
    />
    {/* lower piece (kept), shifted the other way */}
    <polygon
      points="4,16.8 20,7.2 20,19 4,19"
      fill="currentColor"
      fillOpacity="0.45"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      transform="translate(0.5,0.9)"
    />
    {/* cutting stroke */}
    <line
      x1="2"
      y1="18"
      x2="22"
      y2="6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2"
    />
  </SvgIcon>
);

export default IconFaceCut;
