import SvgIcon from "@mui/material/SvgIcon";

// « Orienter le repère » (PLACE_AXES, 3D): the user frame (see IconAxesFrame)
// with a dashed target ring on its origin — the tool places the origin with
// a first click, then points the X axis with a second one.
const IconPlaceAxesFrame = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Z (vertical) */}
    <line
      x1="8"
      y1="18"
      x2="8"
      y2="4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <polyline
      points="5.8,6.2 8,4 10.2,6.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* X (to the right) */}
    <line
      x1="8"
      y1="18"
      x2="21"
      y2="18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <polyline
      points="18.8,15.8 21,18 18.8,20.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Y (receding, in perspective) */}
    <line
      x1="8"
      y1="18"
      x2="15.5"
      y2="10.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* target ring on the origin */}
    <circle
      cx="8"
      cy="18"
      r="4.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray="2.6 1.8"
    />
    <circle cx="8" cy="18" r="1.6" fill="currentColor" />
  </SvgIcon>
);

export default IconPlaceAxesFrame;
