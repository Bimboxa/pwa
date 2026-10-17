import SvgIcon from "@mui/material/SvgIcon";

// « Couper une surface » (SURFACE_CUT, 2D): a filled surface already split in
// two halves, pulled apart along the cut so the separation reads at 18 px,
// with the cutting stroke overshooting the shape at both ends. Distinct from
// IconSplitPolygon (3D « Coupe face »: an outlined polygon with a dashed
// line) and from IconCutLine (segment removal).
const IconCutSurface = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* upper-left half, shifted away from the cut */}
    <polygon points="3,4 16.5,4 3,17.5" fill="currentColor" opacity="0.85" />
    {/* lower-right half, shifted away from the cut */}
    <polygon points="21,7.5 21,21 7.5,21" fill="currentColor" opacity="0.45" />
    {/* cutting stroke along the gap, overshooting the surface */}
    <line
      x1="21.5"
      y1="2.5"
      x2="2.5"
      y2="21.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeDasharray="3 2"
    />
  </SvgIcon>
);

export default IconCutSurface;
