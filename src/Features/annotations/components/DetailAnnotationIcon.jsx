// DETAIL annotation icon — bubble with a letter and a small arrow, matching
// the NodeDetailStatic look (annotation lists / legend rows).
export default function DetailAnnotationIcon({
  fillColor = "#2196f3",
  size = 24,
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <circle
        cx="8"
        cy="10"
        r="6"
        fill="#ffffff"
        stroke={fillColor}
        strokeWidth="2"
      />
      <text
        x="8"
        y="13"
        textAnchor="middle"
        fontSize="8"
        fontWeight="bold"
        fill="#000000"
      >
        A
      </text>
      <path d="M19 10 L14.2 7.8 L14.2 12.2 Z" fill={fillColor} />
    </svg>
  );
}
