import { useMemo } from "react";

// Renders, inside the viewport's camera group (world = map pixels):
//   - the "vue de dessus" recap (top): the whole chain projected, edited
//     segment in the primary color, the rest in grey;
//   - the elevation of the whole chain (per-segment quads): the active/edited
//     band is filled with the primary color, the neighbouring bands with a
//     clarified (lighter) version of it;
//   - vertical separation lines: grey (dashed) outside the wall surface, dashed
//     in the primary color across the surface;
//   - draggable top/bottom handles on the edited segment only.
//
// `color` is the polyline's own color (primary). `dragPreview`
// ({ pointIndex, edge, worldY }) overrides the dragged handle's Y for live
// feedback before the value is committed.
export default function ElevationProfileSvg({
  vertices,
  editedSegmentIndex,
  hoveredSegmentIndex,
  height,
  color = "#c0392b",
  dragPreview,
  onHandleMouseDown,
}) {
  // preview-applied vertices (only affects the dragged handle)
  const verts = useMemo(() => {
    if (!dragPreview) return vertices;
    return vertices.map((v) =>
      v.pointIndex === dragPreview.pointIndex
        ? {
            ...v,
            [dragPreview.edge === "TOP" ? "topY" : "bottomY"]:
              dragPreview.worldY,
          }
        : v
    );
  }, [vertices, dragPreview]);

  if (!vertices || vertices.length < 2) return null;

  // --- vertical extents (stable: from non-preview vertices) ---
  let eMinY = Infinity;
  let eMaxY = -Infinity;
  let pMin = Infinity;
  let pMax = -Infinity;
  for (const v of vertices) {
    eMinY = Math.min(eMinY, v.topY, v.bottomY);
    eMaxY = Math.max(eMaxY, v.topY, v.bottomY);
    pMin = Math.min(pMin, v.planY);
    pMax = Math.max(pMax, v.planY);
  }
  const recapHeight = Math.max(pMax - pMin, 1);
  const GAP = 40;
  const recapY = (planY) => eMinY - GAP - (pMax - planY);
  const gridTop = eMinY - GAP - recapHeight - 6;
  const gridBottom = eMaxY + 6;

  // edited segment vertices (preview-applied for live drag)
  const selA = verts.find((v) => v.pointIndex === editedSegmentIndex);
  const selB = verts.find((v) => v.pointIndex === editedSegmentIndex + 1);

  const COUNTER_ZOOM = { transform: "scale(calc(1 / var(--map-zoom, 1)))" };
  const HALF = 5;
  const GREY = "#bdbdbd";

  return (
    <g>
      {/* vertical separations: grey (dashed) outside the surface, primary
          (dashed) across the surface */}
      {verts.map((v) => {
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
              y1={top}
              x2={v.x}
              y2={bottom}
              stroke={color}
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

      {/* vue de dessus recap (edited segment = primary color, rest = grey) */}
      {verts.slice(0, -1).map((v, j) => {
        const a = verts[j];
        const b = verts[j + 1];
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
      {verts.map((v) => (
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

      {/* elevation of the whole chain (per-segment quads): edited band in the
          primary color, neighbours clarified */}
      {verts.slice(0, -1).map((v, j) => {
        const a = verts[j];
        const b = verts[j + 1];
        const isEdited = a.pointIndex === editedSegmentIndex;
        const isHovered = a.pointIndex === hoveredSegmentIndex;
        return (
          <g key={`elev-${a.pointIndex}`}>
            <path
              d={`M ${a.x} ${a.topY} L ${b.x} ${b.topY} L ${b.x} ${b.bottomY} L ${a.x} ${a.bottomY} Z`}
              fill={color}
              fillOpacity={isEdited ? 0.45 : isHovered ? 0.3 : 0.15}
              stroke="none"
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
            <line
              x1={a.x}
              y1={a.topY}
              x2={b.x}
              y2={b.topY}
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}

      {/* height label on the edited segment */}
      {selA && selB && height > 0 && (
        <g transform={`translate(${selA.x}, ${selA.topY})`}>
          <g style={COUNTER_ZOOM}>
            <text
              x={6}
              y={-4}
              fontSize={11}
              fill={color}
              style={{ userSelect: "none" }}
            >
              {`Ht. ${height} m`}
            </text>
          </g>
        </g>
      )}

      {/* handles: only the edited segment's two vertices */}
      {selA &&
        selB &&
        [selA, selB].map((v) =>
          ["TOP", "BOTTOM"].map((edge) => {
            const y = edge === "TOP" ? v.topY : v.bottomY;
            return (
              <g
                key={`h-${v.pointIndex}-${edge}`}
                transform={`translate(${v.x}, ${y})`}
              >
                <g style={COUNTER_ZOOM}>
                  <rect
                    x={-HALF}
                    y={-HALF}
                    width={HALF * 2}
                    height={HALF * 2}
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth={1.5}
                    data-elev-handle="1"
                    data-point-index={v.pointIndex}
                    data-edge={edge}
                    style={{ cursor: "ns-resize" }}
                    onMouseDown={(e) =>
                      onHandleMouseDown?.(e, v.pointIndex, edge)
                    }
                  />
                </g>
              </g>
            );
          })
        )}
    </g>
  );
}
