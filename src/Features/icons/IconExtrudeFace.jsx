import SvgIcon from "@mui/material/SvgIcon";

// « Extruder » (EXTRUDE, 3D): a face seen head-on pushed along its normal —
// a dashed ghost copy offset in cabinet projection, thin edges joining the
// two, and an arrow along the push direction. The face is drawn after the
// ghost so it covers it.
const IconExtrudeFace = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* ghost copy of the face after extrusion */}
    <polygon
      points="10,3 20,3 20,15 10,15"
      fill="currentColor"
      fillOpacity="0.1"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeDasharray="2.5 2"
    />
    {/* extrusion edges */}
    <line
      x1="3"
      y1="8"
      x2="10"
      y2="3"
      stroke="currentColor"
      strokeWidth="1.1"
      opacity="0.5"
    />
    <line
      x1="13"
      y1="8"
      x2="20"
      y2="3"
      stroke="currentColor"
      strokeWidth="1.1"
      opacity="0.5"
    />
    <line
      x1="13"
      y1="20"
      x2="20"
      y2="15"
      stroke="currentColor"
      strokeWidth="1.1"
      opacity="0.5"
    />
    {/* the face */}
    <rect
      x="3"
      y="8"
      width="10"
      height="12"
      fill="currentColor"
      fillOpacity="0.45"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* push arrow */}
    <line
      x1="9"
      y1="14"
      x2="15.5"
      y2="7.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <polyline
      points="11.5,7.5 15.5,7.5 15.5,11.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

export default IconExtrudeFace;
