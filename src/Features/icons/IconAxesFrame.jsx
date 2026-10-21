import SvgIcon from "@mui/material/SvgIcon";

// « Afficher le repère » (TOGGLE_AXES, 3D): the three axes of the user frame
// seen in perspective — Z up, X to the right, Y receding — with small arrow
// heads. Monochrome (currentColor) so the button follows the toolbar
// states; the coloured version lives in the 3D scene itself.
const IconAxesFrame = (props) => (
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
    <polyline
      points="12.4,10.4 15.5,10.5 15.6,13.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* origin */}
    <circle cx="8" cy="18" r="1.6" fill="currentColor" />
  </SvgIcon>
);

export default IconAxesFrame;
