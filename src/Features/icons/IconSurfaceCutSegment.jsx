import SvgIcon from "@mui/material/SvgIcon";

// « Couper une surface — Segment (2 clics) » (SURFACE_CUT_SEGMENT, 2D): the
// generic segment stroke (two clicked points) drawn over a faded square, the
// surface being cut. Distinct from IconFaceCutSegment (3D « Coupe face »: a
// face split in two tones) and from IconCutSurface (the tool group icon).
const IconSurfaceCutSegment = (props) => (
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
    {/* start point (bottom-left, filled) */}
    <circle cx="5" cy="18" r="2.5" fill="currentColor" />
    {/* cut segment */}
    <line
      x1="6.7"
      y1="16.3"
      x2="17.3"
      y2="7.7"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* end point (top-right, filled) */}
    <circle cx="19" cy="6" r="2.5" fill="currentColor" />
  </SvgIcon>
);

export default IconSurfaceCutSegment;
