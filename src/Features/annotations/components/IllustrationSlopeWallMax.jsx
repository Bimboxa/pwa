// Side-elevation illustration of the "Hauteur max" wall profile:
// flat top at the absolute ceiling (maxHeight), the wall height decreasing
// up-slope until the rising ground reaches the ceiling.
//
// Geometry mirrors buildSlopeWallPolyline with profileType "MAX":
//   ground line rises to the right; wallTop = ceiling (constant).
const FILL = "#F2B85C";

export default function IllustrationSlopeWallMax({ width = "100%" }) {
  return (
    <svg
      viewBox="0 0 160 100"
      width={width}
      role="img"
      aria-label="Hauteur max"
    >
      {/* wall fill: vertical left side, flat ceiling, ground hypotenuse */}
      <polygon points="10,80 10,40 122,40" fill={FILL} />
      {/* ceiling (limite max) */}
      <line
        x1="10"
        y1="40"
        x2="150"
        y2="40"
        stroke="#9e9e9e"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      {/* ground / ramp */}
      <line
        x1="10"
        y1="80"
        x2="150"
        y2="30"
        stroke="#000"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
