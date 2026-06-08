import { useMemo } from "react";

import { Box } from "@mui/material";

// Top recap: a fit-contain plan view of the full polyline. Hovering a segment
// highlights it alone; clicking it selects the maximal projectable chain
// (computed by the parent). The currently selected chain is drawn in bold pink.
export default function PlanSelectorElevation({
  points,
  closeLine = false,
  selectedSegmentIndices,
  seedSegmentIndex,
  hoveredSegmentIndex,
  observationSign = 1,
  onHoverSegment,
  onSelectSegment,
  onSetObservation,
}) {
  // helper - bounds + viewBox (fit-contain over all points, with padding)

  const bounds = useMemo(() => {
    if (!points || points.length === 0)
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
  }, [points]);

  const viewBox = useMemo(() => {
    const { minX, minY, maxX, maxY } = bounds;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const pad = Math.max(w, h) * 0.08 + 4;
    return `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;
  }, [bounds]);

  // projection line (droite) carried by the seed segment, extended to span the
  // whole view — this is the axis the elevation is projected onto
  const projectionLine = useMemo(() => {
    const n = points?.length ?? 0;
    const a = points?.[seedSegmentIndex];
    const b = n > 0 ? points?.[(seedSegmentIndex + 1) % n] : null;
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const { minX, minY, maxX, maxY } = bounds;
    const span = (Math.hypot(maxX - minX, maxY - minY) || 1) * 1.5;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    return {
      x1: cx - ux * span,
      y1: cy - uy * span,
      x2: cx + ux * span,
      y2: cy + uy * span,
    };
  }, [points, seedSegmentIndex, bounds]);

  // two arrows on each side of the seed segment → pick the viewing side
  const observationArrows = useMemo(() => {
    const n = points?.length ?? 0;
    const a = points?.[seedSegmentIndex];
    const b = n > 0 ? points?.[(seedSegmentIndex + 1) % n] : null;
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const { minX, minY, maxX, maxY } = bounds;
    const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
    const dist = Math.max(len * 0.22, diag * 0.035);
    const size = diag * 0.03;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const make = (s) => {
      const ox = cx + nx * s * dist;
      const oy = cy + ny * s * dist;
      // point the arrow toward the segment (inward = -n * s)
      const dirx = -nx * s;
      const diry = -ny * s;
      const tipx = ox + dirx * size;
      const tipy = oy + diry * size;
      const bx = ox - dirx * size * 0.4;
      const by = oy - diry * size * 0.4;
      const c1x = bx + ux * size * 0.7;
      const c1y = by + uy * size * 0.7;
      const c2x = bx - ux * size * 0.7;
      const c2y = by - uy * size * 0.7;
      return { sign: s, points: `${tipx},${tipy} ${c1x},${c1y} ${c2x},${c2y}` };
    };
    return [make(1), make(-1)];
  }, [points, seedSegmentIndex, bounds]);

  // render

  const n = points?.length ?? 0;
  const nSegments = closeLine ? n : n - 1;

  return (
    <Box
      sx={{
        width: 1,
        height: 150,
        bgcolor: "background.paper",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        {/* projection line (droite) carried by the seed segment */}
        {projectionLine && (
          <line
            x1={projectionLine.x1}
            y1={projectionLine.y1}
            x2={projectionLine.x2}
            y2={projectionLine.y2}
            stroke="#76ff03"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {Array.from({ length: Math.max(0, nSegments) }).map((_, i) => {
          const a = points[i];
          const b = points[(i + 1) % n];
          if (!a || !b) return null;
          const isSeed = seedSegmentIndex === i;
          const isHovered = hoveredSegmentIndex === i;
          const color = isSeed ? "#76ff03" : isHovered ? "#2196f3" : "#9e9e9e";
          const width = isSeed ? 5 : isHovered ? 3 : 1.5;
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color}
                strokeWidth={width}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* invisible thick hit area */}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={16}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => onHoverSegment?.(i)}
                onMouseLeave={() => onHoverSegment?.(null)}
                onClick={() => onSelectSegment?.(i)}
              />
            </g>
          );
        })}

        {/* vertices */}
        {points?.map((p, i) => (
          <circle
            key={`v-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="#fff"
            stroke="#616161"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* observation-side arrows */}
        {observationArrows?.map((arr) => {
          const active = arr.sign === observationSign;
          return (
            <polygon
              key={`arrow-${arr.sign}`}
              points={arr.points}
              fill={active ? "#76ff03" : "rgba(255,255,255,0.9)"}
              stroke="#5fae00"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: "pointer" }}
              onClick={() => onSetObservation?.(arr.sign)}
            />
          );
        })}
      </svg>
    </Box>
  );
}
