import SvgIcon from "@mui/material/SvgIcon";

// « Coupe face — Polyligne clic » (FACE_CUT_POLYLINE, 3D): a face seen
// head-on with a cut polyline in progress — two committed points (filled
// dots) joined by a solid stroke, the next one (empty ring) dashed.
const IconFaceCutPolyline = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points="4,5 20,5 20,19 4,19"
      fill="currentColor"
      fillOpacity="0.25"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* committed segment */}
    <line
      x1="6"
      y1="14"
      x2="12"
      y2="15.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    {/* segment being drawn */}
    <line
      x1="12"
      y1="15.5"
      x2="18"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeDasharray="3 2"
    />
    <circle cx="6" cy="14" r="2" fill="currentColor" />
    <circle cx="12" cy="15.5" r="2" fill="currentColor" />
    <circle
      cx="18"
      cy="8"
      r="1.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    />
  </SvgIcon>
);

export default IconFaceCutPolyline;
