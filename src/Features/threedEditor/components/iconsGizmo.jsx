// Custom gizmo icons matching the mockup style: a small cube paired with the
// gizmo's signature element (axis arrows for translate, rotation arc for
// rotate). Hand-rolled SVGs so the visuals stay terse and recognisable at
// icon-button size.

export function IconGizmoTranslate({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cube anchored at lower-left. */}
      <rect x="3" y="14" width="6" height="6" fill={color} stroke="none" />
      {/* +Y arrow ↑ */}
      <line x1="6" y1="12" x2="6" y2="3" />
      <polyline points="3,6 6,3 9,6" />
      {/* +X arrow → */}
      <line x1="11" y1="17" x2="21" y2="17" />
      <polyline points="18,14 21,17 18,20" />
    </svg>
  );
}

export function IconGizmoRotate({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Rotation arc as a perspective ellipse. */}
      <ellipse cx="12" cy="12" rx="9" ry="4" />
      {/* Cube at the centre. */}
      <rect x="9" y="9" width="6" height="6" fill={color} stroke="none" />
    </svg>
  );
}
