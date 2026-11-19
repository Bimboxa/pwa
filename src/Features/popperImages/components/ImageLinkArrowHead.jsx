// Arrow head of a tile → anchor leader (connector end "ARROW" off in situ),
// in the screen-px space of the overlay drawing the leader. The anchor
// itself only shows a small dot in the scene (NodeImageStatic / 3D anchor
// sprite): the head overshoots the anchor by OVERSHOOT_PX so it covers it.
const ARROW_HEAD_PATH = "M0,0 L-13,-5.5 L-13,5.5 Z";
const OVERSHOOT_PX = 5;

export default function ImageLinkArrowHead({ from, to, color }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!dx && !dy) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <g transform={`translate(${to.x}, ${to.y}) rotate(${angle})`}>
      <path
        d={ARROW_HEAD_PATH}
        transform={`translate(${OVERSHOOT_PX}, 0)`}
        fill={color}
        stroke="#fff"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </g>
  );
}
