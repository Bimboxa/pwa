import SvgIcon from "@mui/material/SvgIcon";

// « Couper une surface — Polyligne clic » (SURFACE_CUT_POLYLINE, 2D): the
// generic polyline-in-progress stroke (committed solid segment, next one
// dashed to an empty ring) drawn over a faded square, the surface being cut.
// Distinct from IconFaceCutPolyline (3D « Coupe face ») and from
// IconCutSurface (the tool group icon).
const IconSurfaceCutPolyline = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* surface being cut */}
    <rect
      x="2.5"
      y="2.5"
      width="19"
      height="19"
      rx="1"
      fill="currentColor"
      opacity="0.4"
    />
    {/* bottom-left filled point */}
    <circle cx="6" cy="19" r="2.5" fill="currentColor" />
    {/* committed vertical segment */}
    <line
      x1="6"
      y1="16.5"
      x2="6"
      y2="7.5"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* top-left filled point */}
    <circle cx="6" cy="5" r="2.5" fill="currentColor" />
    {/* segment being drawn */}
    <line
      x1="8.5"
      y1="5"
      x2="16"
      y2="5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 2.5"
    />
    {/* next point (empty ring) */}
    <circle
      cx="19"
      cy="5"
      r="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </SvgIcon>
);

export default IconSurfaceCutPolyline;
