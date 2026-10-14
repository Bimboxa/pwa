import SvgIcon from "@mui/material/SvgIcon";

// Icon of the « Séparer les surfaces en contact » toggle of the 3D view (the
// anti-aliasing shrink / delta offset): two slabs that used to share a seam,
// now pulled apart, with the two arrows leaving that seam. Solid slabs and
// `currentColor` strokes so the active state (white on the action color)
// reads the same as the idle one.
const IconSeparateSurfaces = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* the two slabs, a gap where the seam was */}
    <rect x="2.5" y="9.5" width="7.5" height="11" rx="1" />
    <rect x="14" y="9.5" width="7.5" height="11" rx="1" />
    {/* arrows leaving the seam */}
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5H5.5M8 2.5 5.5 5 8 7.5" />
      <path d="M13 5h5.5M16 2.5 18.5 5 16 7.5" />
    </g>
  </SvgIcon>
);

export default IconSeparateSurfaces;
