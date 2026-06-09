import { useMemo } from "react";

import { useTheme } from "@mui/material";

import MeshDimensionField from "./MeshDimensionField";

// Renders, inside the viewport's camera group (world space = map pixels for
// POLYGON, elevation pixels for POLYLINE):
//   - the mesh cells (filled) with their live surface label (m²);
//   - the base outline;
//   - the cut lines (dashed) with draggable endpoints + a body grab zone;
//   - chained dimension bands (bottom = X gaps, left = Y gaps) whose values are
//     editable to position a cut line precisely.
const COUNTER_ZOOM = { transform: "scale(calc(1 / var(--map-zoom, 1)))" };
const HALF = 5;

function fmtM2(v) {
  if (v == null) return "";
  const r = Math.round(v * 100) / 100;
  return `${r} m²`;
}

// boundaries along one axis between [lo, hi]: edges + the cut lines' mid
// position that falls within the range.
function buildBoundaries(lines, axis, lo, hi) {
  const mids = lines
    .map((l) => ({
      scalar:
        axis === "x" ? (l.p1.x + l.p2.x) / 2 : (l.p1.y + l.p2.y) / 2,
      lineId: l.id,
    }))
    .filter((b) => b.scalar > lo + 1e-6 && b.scalar < hi - 1e-6)
    .sort((a, b) => a.scalar - b.scalar);
  return [
    { scalar: lo, lineId: null },
    ...mids,
    { scalar: hi, lineId: null },
  ];
}

export default function MeshSvg({
  color = "#1976d2",
  meterByPx,
  outlinePoints,
  bbox,
  cells,
  meshLines,
  editing,
  selectedLineId,
  hoveredLineId,
  onLineMouseDown,
  onHoverLine,
  onCommitLinePosition,
  showOutline = true,
  cellFill = true,
  // POLYLINE: restrict the X cotes to the selected band's developed range so
  // only that band shows its cotes; null = full width (POLYGON).
  coteXRange = null,
}) {
  const theme = useTheme();
  const cut = theme.palette.error.main;

  const span = Math.max(bbox.maxX - bbox.minX, 1);
  const dimPad = span * 0.06 + 8;

  const outlinePath = useMemo(() => {
    if (!outlinePoints?.length) return "";
    return (
      outlinePoints
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ") + " Z"
    );
  }, [outlinePoints]);

  const verticalLines = (meshLines ?? []).filter(
    (l) => l.orientation !== "HORIZONTAL"
  );
  const horizontalLines = (meshLines ?? []).filter(
    (l) => l.orientation === "HORIZONTAL"
  );

  const xLo = coteXRange ? coteXRange.min : bbox.minX;
  const xHi = coteXRange ? coteXRange.max : bbox.maxX;
  const xBoundaries = buildBoundaries(verticalLines, "x", xLo, xHi);
  const yBoundaries = buildBoundaries(
    horizontalLines,
    "y",
    bbox.minY,
    bbox.maxY
  );

  // bottom dimension band Y and left dimension band X
  const dimBandY = bbox.maxY + dimPad;
  const dimBandX = xLo - dimPad;

  return (
    <g>
      {/* cells */}
      {cells?.map((cell) => (
        <path
          key={cell.id}
          d={
            cell.points
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ") + " Z"
          }
          fill={color}
          fillOpacity={cellFill ? 0.22 : 0}
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* base outline (POLYGON; for POLYLINE the elevation backdrop draws it) */}
      {showOutline && (
        <path
          d={outlinePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* cell surface labels — only within the selected band when scoped
          (POLYLINE), so non-selected bands don't show their surfaces */}
      {cells?.map((cell) => {
        if (cell.areaM2 == null) return null;
        if (
          coteXRange &&
          (cell.centroid.x < coteXRange.min - 1e-6 ||
            cell.centroid.x > coteXRange.max + 1e-6)
        )
          return null;
        return (
          <g
            key={`lbl-${cell.id}`}
            transform={`translate(${cell.centroid.x}, ${cell.centroid.y})`}
          >
            <g style={COUNTER_ZOOM}>
              <text
                x={0}
                y={0}
                fontSize={13}
                fontWeight={600}
                fill={cut}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ userSelect: "none" }}
              >
                {fmtM2(cell.areaM2)}
              </text>
            </g>
          </g>
        );
      })}

      {/* cut lines */}
      {(meshLines ?? []).map((line) => {
        const isSel = line.id === selectedLineId;
        const isHov = line.id === hoveredLineId;
        return (
          <g key={line.id}>
            {/* body grab zone (translate along normal) */}
            <line
              x1={line.p1.x}
              y1={line.p1.y}
              x2={line.p2.x}
              y2={line.p2.y}
              stroke={cut}
              strokeWidth={isSel || isHov ? 2.5 : 1.75}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
            {editing && (
              <line
                x1={line.p1.x}
                y1={line.p1.y}
                x2={line.p2.x}
                y2={line.p2.y}
                stroke="transparent"
                strokeWidth={14}
                data-mesh-handle="1"
                style={{ cursor: "move" }}
                onMouseEnter={() => onHoverLine?.(line.id)}
                onMouseLeave={() => onHoverLine?.(null)}
                onMouseDown={(e) => onLineMouseDown?.(e, line, "BODY")}
              />
            )}
            {/* endpoint handles */}
            {editing &&
              ["P1", "P2"].map((which) => {
                const p = which === "P1" ? line.p1 : line.p2;
                return (
                  <g
                    key={which}
                    transform={`translate(${p.x}, ${p.y})`}
                  >
                    <g style={COUNTER_ZOOM}>
                      <rect
                        x={-HALF}
                        y={-HALF}
                        width={HALF * 2}
                        height={HALF * 2}
                        fill="#fff"
                        stroke={cut}
                        strokeWidth={1.5}
                        data-mesh-handle="1"
                        style={{ cursor: "grab" }}
                        onMouseDown={(e) =>
                          onLineMouseDown?.(e, line, which)
                        }
                      />
                    </g>
                  </g>
                );
              })}
          </g>
        );
      })}

      {/* bottom dimension band (X gaps) */}
      {xBoundaries.length > 1 && (
        <g>
          <line
            x1={xLo}
            y1={dimBandY}
            x2={xHi}
            y2={dimBandY}
            stroke="#999"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {xBoundaries.map((b, i) => (
            <line
              key={`xtick-${i}`}
              x1={b.scalar}
              y1={dimBandY - 4}
              x2={b.scalar}
              y2={dimBandY + 4}
              stroke="#999"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {xBoundaries.slice(0, -1).map((b, i) => {
            const next = xBoundaries[i + 1];
            const midX = (b.scalar + next.scalar) / 2;
            const distM = (next.scalar - b.scalar) * meterByPx;
            const editable = editing && Boolean(next.lineId || b.lineId);
            return (
              <g
                key={`xdim-${i}`}
                transform={`translate(${midX}, ${dimBandY + 14})`}
              >
                <g style={COUNTER_ZOOM}>
                  <foreignObject
                    x={-40}
                    y={-11}
                    width={80}
                    height={22}
                    style={{ overflow: "visible" }}
                  >
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <MeshDimensionField
                        value={distM}
                        editable={editable}
                        accentColor={cut}
                        onCommit={(v) => {
                          if (next.lineId)
                            onCommitLinePosition?.(
                              next.lineId,
                              "x",
                              b.scalar + v / meterByPx
                            );
                          else if (b.lineId)
                            onCommitLinePosition?.(
                              b.lineId,
                              "x",
                              next.scalar - v / meterByPx
                            );
                        }}
                      />
                    </div>
                  </foreignObject>
                </g>
              </g>
            );
          })}
        </g>
      )}

      {/* left dimension band (Y gaps) */}
      {yBoundaries.length > 1 && (
        <g>
          <line
            x1={dimBandX}
            y1={bbox.minY}
            x2={dimBandX}
            y2={bbox.maxY}
            stroke="#999"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {yBoundaries.map((b, i) => (
            <line
              key={`ytick-${i}`}
              x1={dimBandX - 4}
              y1={b.scalar}
              x2={dimBandX + 4}
              y2={b.scalar}
              stroke="#999"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {yBoundaries.slice(0, -1).map((b, i) => {
            const next = yBoundaries[i + 1];
            const midY = (b.scalar + next.scalar) / 2;
            const distM = (next.scalar - b.scalar) * meterByPx;
            const editable = editing && Boolean(next.lineId || b.lineId);
            return (
              <g
                key={`ydim-${i}`}
                transform={`translate(${dimBandX - 34}, ${midY})`}
              >
                <g style={COUNTER_ZOOM}>
                  <foreignObject
                    x={-40}
                    y={-11}
                    width={80}
                    height={22}
                    style={{ overflow: "visible" }}
                  >
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <MeshDimensionField
                        value={distM}
                        editable={editable}
                        accentColor={cut}
                        onCommit={(v) => {
                          if (next.lineId)
                            onCommitLinePosition?.(
                              next.lineId,
                              "y",
                              b.scalar + v / meterByPx
                            );
                          else if (b.lineId)
                            onCommitLinePosition?.(
                              b.lineId,
                              "y",
                              next.scalar - v / meterByPx
                            );
                        }}
                      />
                    </div>
                  </foreignObject>
                </g>
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}
