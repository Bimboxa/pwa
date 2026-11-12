import SvgIcon from "@mui/material/SvgIcon";

// Toolbar icon of the DRAW_CUT_ANGLE command: the pivot, the reference ray,
// the turned ray and the arc of the angle between them.
export default function IconCutAngle(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d="M5 19 L13.4 19 A8.4 8.4 0 0 0 10.4 12.6 Z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      <line
        x1="5"
        y1="19"
        x2="21"
        y2="19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
      <line
        x1="5"
        y1="19"
        x2="16.5"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M13.4 19 A8.4 8.4 0 0 0 10.4 12.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="5" cy="19" r="2" fill="currentColor" />
    </SvgIcon>
  );
}
