import SvgIcon from "@mui/material/SvgIcon";

// Before -> After: a slab with thin wall slots (one open notch, one enclosed
// slit) becomes a clean filled slab. Mirrors the morphological closing the
// action performs.
const IconCloseWallFootprint = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Source slab (left) with an open notch carved from the bottom edge */}
    <path
      d="M2,6 L10,6 L10,18 L6.6,18 L6.6,11 L5.6,11 L5.6,18 L2,18 Z"
      fill="currentColor"
      opacity="0.35"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Enclosed thin slot inside the source slab */}
    <line
      x1="8"
      y1="8.5"
      x2="8"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    {/* Arrow */}
    <line
      x1="11.5"
      y1="12"
      x2="14.5"
      y2="12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <polyline
      points="13,9.5 15.5,12 13,14.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Result slab (right): clean, no slots */}
    <rect
      x="16.5"
      y="6"
      width="5.5"
      height="12"
      fill="currentColor"
      opacity="0.35"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconCloseWallFootprint;
