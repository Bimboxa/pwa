import SvgIcon from "@mui/material/SvgIcon";

// Segment drag toggle: a segment with its 2 square vertices and a small
// move arrow — distinct from OpenWith (reserved for whole-annotation moves).
const IconSegmentDrag = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* segment */}
    <line
      x1="7"
      y1="17"
      x2="17"
      y2="17"
      stroke="currentColor"
      strokeWidth="2"
    />
    {/* square vertices */}
    <rect x="2.5" y="14.5" width="5" height="5" fill="currentColor" />
    <rect x="16.5" y="14.5" width="5" height="5" fill="currentColor" />
    {/* move arrow */}
    <line
      x1="12"
      y1="14"
      x2="12"
      y2="6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M 8.8 8.2 L 12 4.2 L 15.2 8.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </SvgIcon>
);

export default IconSegmentDrag;
