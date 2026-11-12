import SvgIcon from "@mui/material/SvgIcon";

// Toolbar icon of the DRAW_CUT_SEGMENT command: a two-point cut line stopped
// on the edges / lines it meets (the bars at both ends).
export default function IconCutLineSegment(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <polyline
        points="5,17 19,7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <polyline
        points="2.5,13 7.5,21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <polyline
        points="16.5,3 21.5,11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="5" cy="17" r="2" fill="currentColor" />
      <circle cx="19" cy="7" r="2" fill="currentColor" />
    </SvgIcon>
  );
}
