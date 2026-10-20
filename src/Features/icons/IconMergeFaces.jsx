import SvgIcon from "@mui/material/SvgIcon";

// « Fusionner des faces » (MERGE_FACES, 3D): one face seen head-on whose
// middle edge is vanishing (dashed, faded) while two arrows converge on it.
const IconMergeFaces = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points="4,5 20,5 20,19 4,19"
      fill="currentColor"
      fillOpacity="0.3"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* shared edge being removed */}
    <line
      x1="12"
      y1="5"
      x2="12"
      y2="19"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeDasharray="2 2"
      opacity="0.5"
    />
    {/* converging arrows */}
    <line
      x1="4.5"
      y1="12"
      x2="9.5"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <polyline
      points="7.8,9.8 10,12 7.8,14.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="19.5"
      y1="12"
      x2="14.5"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <polyline
      points="16.2,9.8 14,12 16.2,14.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconMergeFaces;
