// Side-elevation illustration of the "Hauteur constante avec limite" profile:
// the wall keeps a constant height above the slope (top parallel to the ramp),
// then is capped at the absolute ceiling (break point), the wall height then
// decreasing until the rising ground reaches the ceiling.
//
// Geometry mirrors buildSlopeWallPolyline with profileType "CONSTANT":
//   wallTop = min(ground + H, maxHeight). The kink at (66,40) is the break.
const FILL = "#F2B85C";

export default function IllustrationSlopeWallConstant({ width = "100%" }) {
  return (
    <svg
      viewBox="0 0 160 100"
      width={width}
      role="img"
      aria-label="Hauteur constante avec limite"
    >
      {/* wall fill: short left side, parallel top to the break, then flat ceiling */}
      <polygon points="10,80 10,60 66,40 122,40" fill={FILL} />
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
