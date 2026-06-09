// Side-elevation illustration of the "Mur droit" profile: a plain rectangular
// wall on flat ground — flat bottom at level 0, flat top at a constant height.
// The slope is ignored (unlike the CONSTANT / MAX profiles).
const FILL = "#F2B85C";

export default function IllustrationSlopeWallStraight({ width = "100%" }) {
  return (
    <svg viewBox="0 0 160 100" width={width} role="img" aria-label="Mur droit">
      {/* wall fill: full rectangle */}
      <polygon points="10,80 10,40 150,40 150,80" fill={FILL} />
      {/* ground (flat) */}
      <line
        x1="10"
        y1="80"
        x2="150"
        y2="80"
        stroke="#000"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
