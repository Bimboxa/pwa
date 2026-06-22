import { SvgIcon } from "@mui/material";

// Custom icons for the clipping-plane direction presets: a small cabinet-
// projected cube sliced by a cutting plane in three distinct orientations.
// The filled quad is the cutting plane; the thin outline is the cube. Used by
// ClippingToolbarThreed to pick the plane normal (ClippingManager.setAxis).

// Shared cube wireframe (cabinet projection, depth offset +5/-5).
const CUBE = (
  <g
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinejoin="round"
    opacity={0.5}
  >
    <path d="M4,10 L9,5 L19,5 L19,15 L14,20 L4,20 Z" />
    <path d="M4,10 L14,10 M14,10 L14,20 M14,10 L19,5" />
  </g>
);

function PlaneIcon({ planePath, ...props }) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      {CUBE}
      <path
        d={planePath}
        fill="currentColor"
        fillOpacity={0.85}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

// Vertical plane facing the front — normal along three.js Z (default).
export function IconCutPlaneFront(props) {
  return <PlaneIcon planePath="M6.5,7.5 L16.5,7.5 L16.5,17.5 L6.5,17.5 Z" {...props} />;
}

// Vertical plane facing the side — normal along three.js X.
export function IconCutPlaneSide(props) {
  return <PlaneIcon planePath="M9,10 L14,5 L14,15 L9,20 Z" {...props} />;
}

// Horizontal plane — normal along the vertical axis (three.js Y).
export function IconCutPlaneTop(props) {
  return <PlaneIcon planePath="M4,15 L14,15 L19,10 L9,10 Z" {...props} />;
}
