import SvgIcon from "@mui/material/SvgIcon";

const IconCleanSegments = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Vertical wall */}
    <line
      x1="12"
      y1="3"
      x2="12"
      y2="21"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Horizontal wall snapped to vertical's left border */}
    <line
      x1="3"
      y1="9"
      x2="10.5"
      y2="9"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Horizontal wall snapped to vertical's right border */}
    <line
      x1="13.5"
      y1="15"
      x2="21"
      y2="15"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </SvgIcon>
);

export default IconCleanSegments;
