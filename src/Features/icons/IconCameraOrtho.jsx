import SvgIcon from "@mui/material/SvgIcon";

// Icon of the « Caméra ortho » toggle of the 3D view: a box drawn in
// parallel projection (every edge of a family stays parallel — no vanishing
// point), the signature of an orthographic view as opposed to a perspective
// one. `currentColor` strokes so the active state (white on the action
// color) reads the same as the idle one.
const IconCameraOrtho = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* front face */}
      <rect x="3.5" y="8.5" width="11" height="11" rx="0.5" />
      {/* back face, offset by the same parallel vector on every corner */}
      <path d="M3.5 8.5l6-4h11v11l-6 4" />
      <path d="M14.5 8.5l6-4" />
      {/* hidden edges, dashed */}
      <path d="M9.5 4.5v11h11M3.5 19.5l6-4" strokeDasharray="1.2 1.6" />
    </g>
  </SvgIcon>
);

export default IconCameraOrtho;
