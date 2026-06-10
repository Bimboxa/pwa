import { useMemo } from "react";

import { useTheme } from "@mui/material";

import { GAP_PX, RECAP_PAD_PX } from "../elevationLayout";

import FieldElevationOffset from "./FieldElevationOffset";

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
  meterByPx,
  offsetZ = 0,
  color = "#c0392b",
  zoom = 1,
  dragPreview,
  onHandleMouseDown,
  onCommitOffset,
  onCommitOffsetZ,
  onCommitHeight,
}) {
  const theme = useTheme();
  const secondary = theme.palette.secondary.main;

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

  // --- extents (stable: from non-preview vertices) ---
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

  // Horizontal padding stays proportional to the developed width (image px,
  // independent of meterByPx) so the layout is equally "aéré" at any map scale.
  const span = Math.max(xMax - xMin, 1);
  const xPad = span * 0.08 + 10;

  const recapHeight = Math.max(pMax - pMin, 1);
  // Vertical spacing of the recap is FIXED in screen pixels: dividing by the
  // live zoom converts it to world units so the gap/margins stay visually
  // constant whatever the zoom level (only the recap geometry itself scales).
  const RECAP_PAD = RECAP_PAD_PX / zoom; // white padding above & below the recap
  const GAP = (GAP_PX + RECAP_PAD_PX) / zoom; // band bottom sits GAP_PX above the elevation
  const recapY = (planY) => eMinY - GAP - (pMax - planY);
  const recapBandTop = eMinY - GAP - recapHeight - RECAP_PAD;
  const recapBandBottom = eMinY - GAP + RECAP_PAD;
  const recapBandCenter = (recapBandTop + recapBandBottom) / 2;
  const gridTop = recapBandTop - 4 / zoom;
  // the baseMap reference plane is Z = 0 → worldY = 0; keep the grid down to it
  const gridBottom = Math.max(eMaxY, 0) + 6 / zoom;

  // edited segment vertices (preview-applied for live drag). selB is the next
  // real anchor along the chain — NOT verts[selIdx + 1], which on an arc would
  // be a sampled (curve) point rather than the segment's far endpoint.
  const selIdx = verts.findIndex((v) => v.pointIndex === editedSegmentIndex);
  const selA = selIdx >= 0 ? verts[selIdx] : undefined;
  let selB;
  if (selIdx >= 0) {
    for (let k = selIdx + 1; k < verts.length; k++) {
      if (verts[k].pointIndex != null) {
        selB = verts[k];
        break;
      }
    }
  }

  const COUNTER_ZOOM = { transform: "scale(calc(1 / var(--map-zoom, 1)))" };
  const HALF = 5;
  const GREY = "#bdbdbd";

  // live offset value (meters) from a vertex's screen Y
  const offsetTopOf = (v) => -v.topY * meterByPx - height - offsetZ;
  const offsetBottomOf = (v) => -v.bottomY * meterByPx - offsetZ;

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

      {/* "Vue de dessus" label, left side, vertically centered on the band */}
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

      {/* vertical separations: grey (dashed) outside the surface, primary
          (dashed) across the surface. Only on real anchors — sampled arc
          points would otherwise draw a separation at every curve sample. */}
      {verts.map((v) => {
        if (v.pointIndex == null) return null;
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
        const isEdited = a.segIndex === editedSegmentIndex;
        const isHovered = a.segIndex === hoveredSegmentIndex;
        return (
          <line
            key={`recap-${j}`}
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
      {verts.map((v, j) =>
        v.pointIndex == null ? null : (
          <circle
            key={`recap-v-${j}`}
            cx={v.x}
            cy={recapY(v.planY)}
            r={2.5}
            fill="#fff"
            stroke={GREY}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )
      )}

      {/* elevation of the whole chain (per-segment quads): edited band in the
          primary color, neighbours clarified */}
      {verts.slice(0, -1).map((v, j) => {
        const a = verts[j];
        const b = verts[j + 1];
        const isEdited = a.segIndex === editedSegmentIndex;
        const isHovered = a.segIndex === hoveredSegmentIndex;
        return (
          <g key={`elev-${j}`}>
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

      {/* baseMap reference plane (Z = 0): full-width grey dashed line — the
          annotation offset (offsetZ) is measured from it */}
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

      {/* height field, on the far left at mid-wall level (primary color) */}
      <g transform={`translate(${xMin - xPad}, ${(eMinY + eMaxY) / 2})`}>
        <g style={COUNTER_ZOOM}>
          <foreignObject
            x={-128}
            y={-11}
            width={124}
            height={24}
            style={{ overflow: "visible" }}
          >
            <FieldElevationOffset
              label="Ht"
              value={height}
              width={46}
              accentColor={color}
              onCommit={(v) => onCommitHeight?.(v)}
            />
          </foreignObject>
        </g>
      </g>

      {/* offset field, at the baseMap line level but shifted to the left of it
          so it never overlaps the first vertex's offsetBottom field */}
      <g transform={`translate(${xMin - xPad}, 0)`}>
        <g style={COUNTER_ZOOM}>
          <foreignObject
            x={-128}
            y={-11}
            width={124}
            height={24}
            style={{ overflow: "visible" }}
          >
            <FieldElevationOffset
              label="Offset"
              value={offsetZ}
              width={46}
              accentColor={secondary}
              noShadow
              onCommit={(v) => onCommitOffsetZ?.(v)}
            />
          </foreignObject>
        </g>
      </g>

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

      {/* offset fields: 4 minimalist inputs fixed to the edited segment's
          vertices (top/bottom), constant screen size */}
      {selA &&
        selB &&
        [selA, selB].map((v) =>
          ["TOP", "BOTTOM"].map((edge) => {
            const y = edge === "TOP" ? v.topY : v.bottomY;
            const value = edge === "TOP" ? offsetTopOf(v) : offsetBottomOf(v);
            const FW = 66;
            const FH = 22;
            return (
              <g
                key={`f-${v.pointIndex}-${edge}`}
                transform={`translate(${v.x}, ${y})`}
              >
                <g style={COUNTER_ZOOM}>
                  <foreignObject
                    x={-FW / 2}
                    y={edge === "TOP" ? -FH - 10 : 10}
                    width={FW}
                    height={FH}
                    style={{ overflow: "visible" }}
                  >
                    <FieldElevationOffset
                      label="Δ"
                      value={value}
                      onCommit={(val) =>
                        onCommitOffset?.(v.pointIndex, edge, val)
                      }
                    />
                  </foreignObject>
                </g>
              </g>
            );
          })
        )}
    </g>
  );
}
