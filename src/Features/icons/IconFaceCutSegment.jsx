import SvgIcon from "@mui/material/SvgIcon";

// « Coupe face — Segment (2 clics) » (FACE_CUT_SEGMENT, 3D): a face seen
// head-on, split in two tones along the segment drawn between the two clicked
// points (filled dots).
const IconFaceCutSegment = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* piece cut off */}
    <polygon
      points="4,5 20,5 20,7.2 4,16.8"
      fill="currentColor"
      fillOpacity="0.15"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* piece kept */}
    <polygon
      points="4,16.8 20,7.2 20,19 4,19"
      fill="currentColor"
      fillOpacity="0.4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* cut segment between the two clicks */}
    <line
      x1="7"
      y1="15"
      x2="17"
      y2="9"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <circle cx="7" cy="15" r="2" fill="currentColor" />
    <circle cx="17" cy="9" r="2" fill="currentColor" />
  </SvgIcon>
);

export default IconFaceCutSegment;
