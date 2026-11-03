import SvgIcon from "@mui/material/SvgIcon";

// Toolbar icon of the DRAW_CUT_LINE command: a line drawn on a slab, climbing
// a wall (the extension the commit adds, dashed).
export default function IconCutLineTrace(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <polyline
        points="3,19 12,19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <polyline
        points="12,19 17,19 17,6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2.5 2"
      />
      <circle cx="3" cy="19" r="2" fill="currentColor" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
      <circle cx="17" cy="6" r="2" fill="currentColor" />
    </SvgIcon>
  );
}
