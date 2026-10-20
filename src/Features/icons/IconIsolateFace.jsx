import SvgIcon from "@mui/material/SvgIcon";

// « Isoler une face » (ISOLATE_FACE, 3D): a box in cabinet projection whose
// front face is kept (solid fill) while the neighbouring faces fade to a
// dashed outline.
const IconIsolateFace = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* top face, fading */}
    <polygon
      points="4,9 14,9 19,4 9,4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeDasharray="2.5 2"
      opacity="0.5"
    />
    {/* side face, fading */}
    <polygon
      points="14,9 19,4 19,14 14,19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeDasharray="2.5 2"
      opacity="0.5"
    />
    {/* isolated front face */}
    <rect
      x="4"
      y="9"
      width="10"
      height="10"
      fill="currentColor"
      fillOpacity="0.9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconIsolateFace;
