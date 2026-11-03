import SvgIcon from "@mui/material/SvgIcon";

// « Axe sur plan de coupe » (PLACE_REVOLUTION_AXIS): the inverted T of the
// axis placement mark — the vertical axis standing on its base point (same
// glyph as the header of the « Axes de révolution » section).
const IconPlaceRevolutionAxis = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* vertical axis */}
    <line
      x1="12"
      y1="4"
      x2="12"
      y2="19"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* base line */}
    <line
      x1="5"
      y1="19"
      x2="19"
      y2="19"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </SvgIcon>
);

export default IconPlaceRevolutionAxis;
