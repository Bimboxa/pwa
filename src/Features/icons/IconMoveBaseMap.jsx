import SvgIcon from "@mui/material/SvgIcon";

// « Déplacer le fond de plan » (MOVE_BASE_MAP, 3D): the four-arrow move cross
// above a losange standing for a base map seen in perspective, so the button
// reads differently from « Déplacer l'annotation » (OpenWith).
const IconMoveBaseMap = (props) => (
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
    {/* move cross */}
    <line
      x1="5"
      y1="7"
      x2="19"
      y2="7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="12"
      y1="2"
      x2="12"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* arrow heads: left, right, top, bottom */}
    <polyline
      points="7.2,4.8 5,7 7.2,9.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="16.8,4.8 19,7 16.8,9.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="9.8,4.2 12,2 14.2,4.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="9.8,9.8 12,12 14.2,9.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconMoveBaseMap;
