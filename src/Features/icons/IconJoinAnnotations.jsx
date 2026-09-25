import SvgIcon from "@mui/material/SvgIcon";

// "Joindre" tool: two thick walls meeting at a corner, the dashed piece being
// the extension that closes the gap.
const IconJoinAnnotations = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Vertical wall coming up to the corner */}
    <line
      x1="7"
      y1="21"
      x2="7"
      y2="11"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="butt"
    />
    {/* Horizontal wall arriving at the corner */}
    <line
      x1="21"
      y1="7"
      x2="12"
      y2="7"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="butt"
    />
    {/* Extensions filling the corner */}
    <line
      x1="7"
      y1="11"
      x2="7"
      y2="5"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="butt"
      strokeDasharray="2 1.5"
      opacity="0.55"
    />
    <line
      x1="12"
      y1="7"
      x2="8"
      y2="7"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="butt"
      strokeDasharray="2 1.5"
      opacity="0.55"
    />
    {/* Selection frame */}
    <rect
      x="2.5"
      y="2.5"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="1.5 1.5"
      opacity="0.7"
    />
  </SvgIcon>
);

export default IconJoinAnnotations;
