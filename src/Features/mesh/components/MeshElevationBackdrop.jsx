import { useTheme } from "@mui/material";

// Non-interactive elevation backdrop for the POLYLINE mesh view, adapted from
// ElevationProfileSvg (recap "vue de dessus" + per-segment elevation bands +
// vertical separations + baseMap reference line) WITHOUT the drag handles /
// offset fields. The mesh cells + cut lines + cotes are drawn on top by MeshSvg.
//
// `vertices` come from useElevationProfile (x, topY, bottomY, planY, pointIndex).
// `editedSegmentIndex` (the band currently editable) is highlighted.
const COUNTER_ZOOM = { transform: "scale(calc(1 / var(--map-zoom, 1)))" };
const GREY = "#bdbdbd";

export default function MeshElevationBackdrop({
  vertices,
  editedSegmentIndex,
  hoveredSegmentIndex,
  color = "#1976d2",
}) {
  const theme = useTheme();
  const secondary = theme.palette.secondary.main;

  if (!vertices || vertices.length < 2) return null;

  // extents
  let eMinY = Infinity;
  let eMaxY = -Infinity;
  let pMin = Infinity;
  let pMax = -Infinity;
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const v of vertices) {
    eMinY = Math.min(eMinY, v.topY, v.bottomY);
    eMaxY = Math.max(eMaxY, v.topY, v.bottomY);
    pMin = Math.min(pMin, v.planY);
    pMax = Math.max(pMax, v.planY);
    xMin = Math.min(xMin, v.x);
    xMax = Math.max(xMax, v.x);
  }

  const span = Math.max(xMax - xMin, 1);
  const xPad = span * 0.08 + 10;
  const recapHeight = Math.max(pMax - pMin, 1);
  const GAP = span * 0.45;
  const recapY = (planY) => eMinY - GAP - (pMax - planY);
  const RECAP_PAD = span * 0.18;
  const recapBandTop = eMinY - GAP - recapHeight - RECAP_PAD;
  const recapBandBottom = eMinY - GAP + RECAP_PAD;
  const recapBandCenter = (recapBandTop + recapBandBottom) / 2;
  const gridTop = recapBandTop - 4;
  const gridBottom = Math.max(eMaxY, 0) + 6;

  return (
    <g>
      {/* white background band behind the "vue de dessus" recap */}
      <rect
        x={xMin - xPad}
        y={recapBandTop}
        width={xMax - xMin + xPad * 2}
        height={recapBandBottom - recapBandTop}
        fill="#ffffff"
        stroke="none"
      />

      {/* "Vue de dessus" label */}
      <g transform={`translate(${xMin - xPad}, ${recapBandCenter})`}>
        <g style={COUNTER_ZOOM}>
          <text
            x={-128}
            y={0}
            fontSize={12}
            fill="#666"
            dominantBaseline="middle"
            style={{ userSelect: "none" }}
          >
            Vue de dessus
          </text>
        </g>
      </g>

      {/* vertical separations: grey outside the surface, primary across it */}
      {vertices.map((v) => {
        const top = Math.min(v.topY, v.bottomY);
        const bottom = Math.max(v.topY, v.bottomY);
        return (
          <g key={`grid-${v.pointIndex}`}>
            <line
              x1={v.x}
              y1={gridTop}
              x2={v.x}
              y2={top}
              stroke={GREY}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={v.x}
              y1={bottom}
              x2={v.x}
              y2={gridBottom}
              stroke={GREY}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}

      {/* vue de dessus recap (edited band = primary, rest = grey) */}
      {vertices.slice(0, -1).map((v, j) => {
        const a = vertices[j];
        const b = vertices[j + 1];
        const isEdited = a.pointIndex === editedSegmentIndex;
        const isHovered = a.pointIndex === hoveredSegmentIndex;
        return (
          <line
            key={`recap-${a.pointIndex}`}
            x1={a.x}
            y1={recapY(a.planY)}
            x2={b.x}
            y2={recapY(b.planY)}
            stroke={isEdited || isHovered ? color : GREY}
            strokeWidth={isEdited ? 4 : isHovered ? 3 : 1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {vertices.map((v) => (
        <circle
          key={`recap-v-${v.pointIndex}`}
          cx={v.x}
          cy={recapY(v.planY)}
          r={2.5}
          fill="#fff"
          stroke={GREY}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* elevation bands per segment (edited band emphasized) */}
      {vertices.slice(0, -1).map((v, j) => {
        const a = vertices[j];
        const b = vertices[j + 1];
        const isEdited = a.pointIndex === editedSegmentIndex;
        const isHovered = a.pointIndex === hoveredSegmentIndex;
        return (
          <g key={`elev-${a.pointIndex}`}>
            <path
              d={`M ${a.x} ${a.topY} L ${b.x} ${b.topY} L ${b.x} ${b.bottomY} L ${a.x} ${a.bottomY} Z`}
              fill={color}
              fillOpacity={isEdited ? 0.16 : isHovered ? 0.1 : 0.05}
              stroke="none"
            />
            <line
              x1={a.x}
              y1={a.topY}
              x2={b.x}
              y2={b.topY}
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={a.x}
              y1={a.bottomY}
              x2={b.x}
              y2={b.bottomY}
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}

      {/* baseMap reference plane (Z = 0) */}
      <line
        x1={xMin - xPad}
        y1={0}
        x2={xMax + xPad}
        y2={0}
        stroke={secondary}
        strokeWidth={1.25}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}
