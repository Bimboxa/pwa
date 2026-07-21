import { useMemo } from "react";

import { useTheme } from "@mui/material";

import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

import FieldElevationOffset from "./FieldElevationOffset";

const PROFILE_COLOR = "#00897b";

// Developed section of ONE shell profile line (profileLines), rendered inside
// the viewport's camera group. X = curvilinear distance along the profile
// (plan px), Y = -(z_m) / meterByPx — see buildProfileSectionGeometry.
//
//   - the section polyline (teal, like the 2D profile stroke),
//   - interior vertices: draggable square handles (vertical only) + one
//     numeric field each (height in meters, offsetTop semantics),
//   - endpoints: grey locked circles (continuity with the contour) with a
//     read-only value label,
//   - snap helper on the section segments: clicking inserts a vertex at the
//     interpolated height,
//   - Z = 0 reference line + Offset field (same as the other modes).
export default function ElevationProfileSectionSvg({
  vertices, // [{ s, topY, height, vertexIndex, locked }]
  meterByPx,
  height = 0,
  offsetZ = 0,
  zoom = 1,
  dragPreview,
  selectedVertexIndex = null,
  onVertexMouseDown,
  onSelectVertex,
  onCommitVertexHeight,
  onCommitOffsetZ,
  hoverWorldPos = null,
  onInsertVertex,
}) {
  const theme = useTheme();
  const secondary = theme.palette.secondary.main;

  // preview-applied vertices (the dragged handle's Y follows the cursor)
  const verts = useMemo(() => {
    if (!dragPreview || dragPreview.profileVertexIndex == null) return vertices;
    return vertices.map((v) =>
      v.vertexIndex === dragPreview.profileVertexIndex
        ? { ...v, topY: dragPreview.worldY }
        : v
    );
  }, [vertices, dragPreview]);

  // Snap helper: projection of the cursor on the nearest section segment.
  // Hidden near an existing handle so those stay clickable.
  const snapHelper = useMemo(() => {
    if (!verts || verts.length < 2 || !hoverWorldPos || dragPreview) {
      return null;
    }
    const NEAR_HANDLE_PX = 14;
    for (const v of verts) {
      if (
        Math.hypot(hoverWorldPos.x - v.s, hoverWorldPos.y - v.topY) * zoom <=
        NEAR_HANDLE_PX
      ) {
        return null;
      }
    }
    const proj = projectPointOnPolyline(
      { x: hoverWorldPos.x, y: hoverWorldPos.y },
      verts.map((v) => ({ x: v.s, y: v.topY }))
    );
    if (!proj) return null;
    if (proj.distance * zoom > 24) return null;
    // Segment index + parameter from the arc-length `s`.
    let segIndex = 0;
    for (let j = 0; j < verts.length - 1; j++) {
      if (proj.s >= verts[j].s && proj.s <= verts[j + 1].s + 1e-9) {
        segIndex = j;
        break;
      }
    }
    const a = verts[segIndex];
    const b = verts[segIndex + 1];
    const span = Math.max(b.s - a.s, 1e-9);
    const t = Math.max(0, Math.min(1, (proj.s - a.s) / span));
    return {
      x: proj.projected.x,
      y: proj.projected.y,
      segIndex,
      t,
      height: a.height + (b.height - a.height) * t,
    };
  }, [verts, hoverWorldPos, dragPreview, zoom]);

  if (!vertices || vertices.length < 2) return null;

  let xMin = Infinity;
  let xMax = -Infinity;
  for (const v of vertices) {
    if (v.s < xMin) xMin = v.s;
    if (v.s > xMax) xMax = v.s;
  }
  const span = Math.max(xMax - xMin, 1);
  const xPad = span * 0.08 + 10;

  const COUNTER_ZOOM = { transform: "scale(calc(1 / var(--map-zoom, 1)))" };
  const HALF = 5;
  const GREY = "#9e9e9e";
  const FW = 66;
  const FH = 22;

  // live height (meters) from a preview-applied screen Y (TOP semantics)
  const liveHeightOf = (v) => -v.topY * meterByPx - height - offsetZ;

  return (
    <g>
      {/* section polyline */}
      <polyline
        points={verts.map((v) => `${v.s},${v.topY}`).join(" ")}
        fill="none"
        stroke={PROFILE_COLOR}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

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

      {/* offset field, left of the Z = 0 line */}
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

      {/* vertices: interior = draggable squares + field; endpoints = locked
          grey circles + read-only label (continuity with the contour) */}
      {verts.map((v) => {
        const liveHeight = liveHeightOf(v);
        if (v.locked) {
          return (
            <g key={`sec-v-${v.vertexIndex}`}>
              <g transform={`translate(${v.s}, ${v.topY})`}>
                <g style={COUNTER_ZOOM}>
                  <circle
                    r={HALF - 1}
                    fill={GREY}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    style={{ pointerEvents: "none" }}
                  />
                  <text
                    x={0}
                    y={-12}
                    textAnchor="middle"
                    fontSize={11}
                    fill={GREY}
                    style={{ userSelect: "none" }}
                  >
                    {`${Math.round(v.height * 100) / 100} m`}
                  </text>
                </g>
              </g>
            </g>
          );
        }
        const isSelected = selectedVertexIndex === v.vertexIndex;
        return (
          <g key={`sec-v-${v.vertexIndex}`}>
            <g transform={`translate(${v.s}, ${v.topY})`}>
              <g style={COUNTER_ZOOM}>
                <rect
                  x={-HALF}
                  y={-HALF}
                  width={HALF * 2}
                  height={HALF * 2}
                  fill={isSelected ? PROFILE_COLOR : "#ffffff"}
                  stroke={PROFILE_COLOR}
                  strokeWidth={1.5}
                  data-elev-handle="1"
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={(e) => {
                    onSelectVertex?.(v.vertexIndex);
                    onVertexMouseDown?.(e, { vertexIndex: v.vertexIndex });
                  }}
                />
              </g>
            </g>
            <g transform={`translate(${v.s}, ${v.topY})`}>
              <g style={COUNTER_ZOOM}>
                <foreignObject
                  x={-FW / 2}
                  y={-FH - 10}
                  width={FW}
                  height={FH}
                  style={{ overflow: "visible" }}
                >
                  <FieldElevationOffset
                    label="Δ"
                    value={liveHeight}
                    accentColor={PROFILE_COLOR}
                    onCommit={(val) =>
                      onCommitVertexHeight?.(v.vertexIndex, val)
                    }
                  />
                </foreignObject>
              </g>
            </g>
          </g>
        );
      })}

      {/* insert-vertex snap helper */}
      {snapHelper && (
        <g transform={`translate(${snapHelper.x}, ${snapHelper.y})`}>
          <g style={COUNTER_ZOOM}>
            <circle
              r={4}
              fill="rgba(0, 137, 123, 0.25)"
              stroke={PROFILE_COLOR}
              strokeWidth={1.5}
              data-elev-handle="1"
              style={{ cursor: "copy" }}
              onClick={(e) => {
                e.stopPropagation();
                onInsertVertex?.({
                  segIndex: snapHelper.segIndex,
                  t: snapHelper.t,
                  height: snapHelper.height,
                });
              }}
            />
          </g>
        </g>
      )}
    </g>
  );
}
