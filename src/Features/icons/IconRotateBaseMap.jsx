import SvgIcon from "@mui/material/SvgIcon";

// « Tourner le fond de plan » (ROTATE_BASE_MAP, 3D): a clockwise rotation arc
// above a losange standing for a base map seen in perspective, so the button
// reads differently from « Tourner l'annotation » (RotateRight).
const IconRotateBaseMap = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* base map: a flat plan seen in perspective */}
    <polygon
      points="12,13.5 21,17.5 12,21.5 3,17.5"
      fill="currentColor"
      fillOpacity="0.3"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* a wall trace on the plan */}
    <polyline
      points="7.5,17.5 12,15.5 16.5,17.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.5"
    />
    {/* rotation arc, clockwise: starts at the right, runs down, left and up
        to the top, where the arrow head points right into the gap */}
    <path
      d="M 16.3 7.5 A 4.3 4.3 0 1 1 12 3.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* arrow head at the end of the arc */}
    <polyline
      points="10.2,1.4 12.2,3.2 10.2,5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconRotateBaseMap;
