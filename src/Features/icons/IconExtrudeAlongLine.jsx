import SvgIcon from "@mui/material/SvgIcon";

// « Extruder le long d'une ligne » (EXTRUDE_ALONG_LINE): a small L-shaped
// cross-section swept along a curved guide — the guide as a thick stroke,
// the profile at its start, a dashed ghost of the profile at its end and the
// swept ribbon in between.
const IconExtrudeAlongLine = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* swept ribbon */}
    <path
      d="M4,17 C8,17 9,9 14,9 L14,5 C8,5 7,13 4,13 Z"
      fill="currentColor"
      fillOpacity="0.25"
      stroke="none"
    />
    {/* guide line */}
    <path
      d="M4,17 C8,17 9,9 14,9 L20,9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    {/* profile (L section) at the start */}
    <polyline
      points="4,17 4,13 7,13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* ghost profile at the end */}
    <polyline
      points="20,9 20,5 17,5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="2 1.5"
    />
  </SvgIcon>
);

export default IconExtrudeAlongLine;
