import SvgIcon from "@mui/material/SvgIcon";

// « Créer le fond de plan » (e.g. the coupe page of a REVOLUTION_AXIS): a plus
// sign above the losange standing for a base map seen in perspective (same
// glyph as IconMoveBaseMap / IconRotateBaseMap), so the button reads as
// "new base map" rather than a generic add.
const IconCreateBaseMap = (props) => (
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
    {/* plus sign */}
    <line
      x1="12"
      y1="3"
      x2="12"
      y2="11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="8"
      y1="7"
      x2="16"
      y2="7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </SvgIcon>
);

export default IconCreateBaseMap;
