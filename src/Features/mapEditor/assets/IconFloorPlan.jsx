export default function IconFloorPlan({ size = 280 }) {
  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 400 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Grid lines (files) */}
      <g stroke="currentColor" strokeWidth="0.5" opacity="0.25">
        {/* Vertical */}
        <line x1="80" y1="20" x2="80" y2="240" />
        <line x1="160" y1="20" x2="160" y2="240" />
        <line x1="240" y1="20" x2="240" y2="240" />
        <line x1="320" y1="20" x2="320" y2="240" />
        {/* Horizontal */}
        <line x1="30" y1="60" x2="370" y2="60" />
        <line x1="30" y1="130" x2="370" y2="130" />
        <line x1="30" y1="200" x2="370" y2="200" />
      </g>

      {/* Outer walls */}
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="square" opacity="0.5">
        {/* Outer rectangle */}
        <line x1="40" y1="30" x2="360" y2="30" />
        <line x1="360" y1="30" x2="360" y2="240" />
        <line x1="360" y1="240" x2="40" y2="240" />
        <line x1="40" y1="240" x2="40" y2="30" />
      </g>

      {/* Inner walls */}
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="square" opacity="0.4">
        {/* Horizontal partition */}
        <line x1="40" y1="130" x2="200" y2="130" />
        <line x1="230" y1="130" x2="360" y2="130" />

        {/* Vertical partition left */}
        <line x1="160" y1="30" x2="160" y2="100" />
        <line x1="160" y1="120" x2="160" y2="130" />

        {/* Vertical partition right */}
        <line x1="270" y1="130" x2="270" y2="200" />
        <line x1="270" y1="220" x2="270" y2="240" />

        {/* Small room bottom-left */}
        <line x1="120" y1="130" x2="120" y2="190" />
        <line x1="40" y1="190" x2="120" y2="190" />
      </g>

      {/* Door arcs */}
      <g stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3">
        {/* Door on horizontal wall */}
        <path d="M 200 130 A 30 30 0 0 1 230 130" />
        {/* Door on left vertical */}
        <path d="M 160 100 A 20 20 0 0 0 160 120" />
        {/* Door on right vertical */}
        <path d="M 270 200 A 20 20 0 0 1 270 220" />
      </g>

      {/* Cartouche bottom-right */}
      <g opacity="0.35">
        <rect
          x="290"
          y="205"
          width="60"
          height="28"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Lines inside cartouche */}
        <line x1="296" y1="213" x2="338" y2="213" stroke="currentColor" strokeWidth="1" />
        <line x1="296" y1="219" x2="330" y2="219" stroke="currentColor" strokeWidth="1" />
        <line x1="296" y1="225" x2="320" y2="225" stroke="currentColor" strokeWidth="0.7" />
      </g>
    </svg>
  );
}
