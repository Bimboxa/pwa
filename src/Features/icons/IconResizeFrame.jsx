import SvgIcon from "@mui/material/SvgIcon";

// « Déplacer / Redimensionner » toggle (transform frame of the selection):
// a selection frame with its corner handles and a diagonal resize arrow
// pulling the bottom-right corner — distinct from OpenWith (the 4-arrow
// cross reserved for « Déplacer », M) and from the drawing shapes.
const IconResizeFrame = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* selection frame (dashed) */}
    <rect
      x="4"
      y="4"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeDasharray="2.4 1.8"
    />
    {/* corner handles */}
    <rect x="2.2" y="2.2" width="3.6" height="3.6" fill="currentColor" />
    <rect x="13.2" y="2.2" width="3.6" height="3.6" fill="currentColor" />
    <rect x="2.2" y="13.2" width="3.6" height="3.6" fill="currentColor" />
    {/* diagonal resize arrow from the bottom-right corner */}
    <line
      x1="14.5"
      y1="14.5"
      x2="20.5"
      y2="20.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M 16.2 21 L 21 21 L 21 16.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </SvgIcon>
);

export default IconResizeFrame;
