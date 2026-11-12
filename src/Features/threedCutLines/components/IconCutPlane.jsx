import SvgIcon from "@mui/material/SvgIcon";

// Toolbar icon of the DRAW_CUT_PLANE command: the drawn axis (two points)
// crossed by the cut plane it is normal to.
export default function IconCutPlane(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <polygon
        points="13,3 20,6 20,21 13,18"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <line
        x1="4"
        y1="12"
        x2="16.5"
        y2="12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="4" cy="12" r="2" fill="currentColor" />
      <circle cx="16.5" cy="12" r="2" fill="currentColor" />
    </SvgIcon>
  );
}
