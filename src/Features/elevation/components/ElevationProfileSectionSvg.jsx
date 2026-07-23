import { useMemo, useRef } from "react";

import { useTheme } from "@mui/material";

import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";
import { circleFromThreePoints } from "Features/geometry/utils/arcSampling";

import FieldElevationOffset from "./FieldElevationOffset";

const DEFAULT_PROFILE_COLOR = "#00897b";

// SVG path of the section curve: straight segments, except around "circle"
// vertices (arc control points) where prev → control → next is drawn as the
// circular arc through the 3 section points (S-C-S, like plan arcs in
// NodePolylineStatic). Falls back to straight lines on degenerate circles.
function sectionPathD(verts) {
  if (!verts || verts.length < 2) return "";
  let d = `M ${verts[0].s} ${verts[0].topY}`;
  let i = 1;
  while (i < verts.length) {
    const v = verts[i];
    if (v.type === "circle" && i + 1 < verts.length) {
      const p0 = { x: verts[i - 1].s, y: verts[i - 1].topY };
      const p1 = { x: v.s, y: v.topY };
      const p2 = { x: verts[i + 1].s, y: verts[i + 1].topY };
      const circ = circleFromThreePoints(p0, p1, p2);
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const cross =
          (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        const sweep = cross > 0 ? 1 : 0;
        d += ` A ${circ.r} ${circ.r} 0 0 ${sweep} ${p2.x} ${p2.y}`;
        i += 2;
        continue;
      }
    }
    d += ` L ${v.s} ${v.topY}`;
    i += 1;
  }
  return d;
}

// Developed section of ONE shell profile line (profileLines), rendered inside
// the viewport's camera group. X = curvilinear distance along the profile
// (plan px), Y = -(z_m) / meterByPx — see buildProfileSectionGeometry.
//
//   - the section polyline (teal, like the 2D profile stroke),
//   - interior vertices: freely draggable square handles (Y = height, X =
//     slide along the profile path in plan, clamped between neighbors) + one
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
  // annotation color — the section curve + its handles are drawn with it
  color = DEFAULT_PROFILE_COLOR,
  dragPreview,
  selectedVertexIndex = null,
  // hide the per-vertex Δ height labels (the selected vertex keeps its field
  // so it stays editable). The Z axis is a screen-fixed overlay in the
  // parent, not drawn here.
  showLabels = true,
  // World x of the screen-fixed Z axis + which edge it is on ("left" /
  // "right"). The Z = 0 line runs up to it and the Offset field sits a fixed
  // screen distance from it, on that side. Null → fall back to the profile
  // extent (no camera yet).
  zAxisWorldX = null,
  zAxisSide = "right",
  onVertexMouseDown,
  onSelectVertex,
  onToggleVertexType,
  onCommitVertexHeight,
  onCommitOffsetZ,
  hoverWorldPos = null,
  onInsertVertex,
  // POLYLINE extrusion: reference "trait" = the crossed guide segment
  // projected on the section plane ({ extremities: [{s, y}×2],
  // anchorExtremityIndex }). Its extremities are the registration/snap
  // targets of the 3D sweep.
  guideTrait = null,
}) {
  const theme = useTheme();
  const secondary = theme.palette.secondary.main;

  // Click-vs-drag discrimination for the toggle gesture: re-clicking an
  // ALREADY selected vertex (without dragging) toggles square ↔ circle.
  const downRef = useRef(null); // { vertexIndex, x, y, wasSelected }

  // preview-applied vertices: the dragged handle follows the cursor on BOTH
  // axes — Y (height) freely, X (curvilinear s) clamped between its neighbor
  // vertices (same bounds as the commit).
  const verts = useMemo(() => {
    if (!dragPreview || dragPreview.profileVertexIndex == null) return vertices;
    return vertices.map((v) => {
      if (v.vertexIndex !== dragPreview.profileVertexIndex) return v;
      const next = { ...v, topY: dragPreview.worldY };
      if (
        Number.isFinite(dragPreview.worldX) &&
        Number.isFinite(dragPreview.sMin) &&
        Number.isFinite(dragPreview.sMax)
      ) {
        next.s = Math.max(
          dragPreview.sMin,
          Math.min(dragPreview.sMax, dragPreview.worldX)
        );
      }
      return next;
    });
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
    // The projection carries its own segment + local parameter — an abscissa
    // scan would be ambiguous on FREE profiles (Z / U shapes fold back, so
    // several segments span the same section X).
    const { segIndex, t } = proj;
    const a = verts[segIndex];
    const b = verts[segIndex + 1];
    if (!a || !b) return null;
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
  let yTop = 0;
  let yBottom = 0;
  for (const v of vertices) {
    if (v.s < xMin) xMin = v.s;
    if (v.s > xMax) xMax = v.s;
    if (v.topY < yTop) yTop = v.topY;
    if (v.topY > yBottom) yBottom = v.topY;
  }
  if (guideTrait?.footprint?.y != null) {
    if (guideTrait.footprint.y < yTop) yTop = guideTrait.footprint.y;
    if (guideTrait.footprint.y > yBottom) yBottom = guideTrait.footprint.y;
  }
  const span = Math.max(xMax - xMin, 1);
  const xPad = span * 0.08 + 10;
  const yExtent = Math.max(yBottom - yTop, 1);
  const yPad = yExtent * 0.15 + 10;

  const COUNTER_ZOOM = { transform: "scale(calc(1 / var(--map-zoom, 1)))" };
  const HALF = 5;
  const GREY = "#9e9e9e";
  const FW = 66;
  const FH = 22;
  // screen-px gap between a vertex and the bottom of its height label, so the
  // label sits clearly ABOVE the handle and the section stroke
  const LABEL_GAP = 16;

  // live height (meters) from a preview-applied screen Y (TOP semantics)
  const liveHeightOf = (v) => -v.topY * meterByPx - height - offsetZ;

  // Z = 0 line + Offset field anchor to the screen-fixed Z axis (zAxisWorldX)
  // when known, so the dashed line always reaches it and the field stays a
  // fixed screen distance from it, on the axis side. Fallback (no camera yet)
  // = the profile extent / legacy left placement.
  const hasAxis = Number.isFinite(zAxisWorldX);
  const z0x1 = hasAxis ? Math.min(xMin - xPad, zAxisWorldX) : xMin - xPad;
  const z0x2 = hasAxis ? Math.max(xMax + xPad, zAxisWorldX) : xMax + xPad;
  const OFFSET_GAP_PX = 8; // screen gap between the axis and the field
  const OFFSET_W = 124; // field width (screen px)
  const offsetAnchorX = hasAxis ? zAxisWorldX : xMin - xPad;
  const offsetFieldX = !hasAxis
    ? -(OFFSET_GAP_PX + OFFSET_W) // legacy: left of the profile
    : zAxisSide === "right"
      ? -(OFFSET_GAP_PX + OFFSET_W) // inside, left of the right axis
      : OFFSET_GAP_PX; // inside, right of the left axis

  return (
    <g>
      {/* section curve (arcs around "circle" control vertices) */}
      <path
        d={sectionPathD(verts)}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* baseMap reference plane (Z = 0) — extended to reach the Z axis */}
      <line
        x1={z0x1}
        y1={0}
        x2={z0x2}
        y2={0}
        stroke={secondary}
        strokeWidth={1.25}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
      />

      {/* POLYLINE extrusion reference trait: the FULL polyline footprint
          projected on the section plane — a single grey horizontal line. Its
          extremities stay SNAP targets for the vertex drag but are not drawn
          (no marker helpers on the guide trait). */}
      {guideTrait && guideTrait.extremities?.length === 2 && (
        <line
          x1={guideTrait.footprint?.s1 ?? guideTrait.extremities[0].s}
          y1={guideTrait.footprint?.y ?? guideTrait.extremities[0].y}
          x2={guideTrait.footprint?.s2 ?? guideTrait.extremities[1].s}
          y2={guideTrait.footprint?.y ?? guideTrait.extremities[1].y}
          stroke={GREY}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Median axis: vertical dashed line at the guide center (circle
          center) projected on the profile axis — a snap target for the
          profile vertices. */}
      {guideTrait && Number.isFinite(guideTrait.medianS) && (
        <line
          x1={guideTrait.medianS}
          y1={yTop - yPad}
          x2={guideTrait.medianS}
          y2={yBottom + yPad}
          stroke={GREY}
          strokeWidth={1.25}
          strokeDasharray="5 4"
          strokeOpacity={0.7}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* offset field — fixed screen distance from the Z axis, on its side */}
      <g transform={`translate(${offsetAnchorX}, 0)`}>
        <g style={COUNTER_ZOOM}>
          <foreignObject
            x={offsetFieldX}
            y={-11}
            width={OFFSET_W}
            height={24}
            style={{ overflow: "visible" }}
          >
            {/* hug the axis-facing edge so the field stays at a fixed screen
                distance from the axis whatever its content width */}
            <div
              style={{
                display: "flex",
                width: "100%",
                justifyContent:
                  zAxisSide === "right" || !hasAxis ? "flex-end" : "flex-start",
              }}
            >
              <FieldElevationOffset
                label="Offset"
                value={offsetZ}
                width={46}
                accentColor={secondary}
                noShadow
                onCommit={(v) => onCommitOffsetZ?.(v)}
              />
            </div>
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
                  {showLabels && (
                    <text
                      x={0}
                      y={-(HALF + LABEL_GAP)}
                      textAnchor="middle"
                      fontSize={11}
                      fill={GREY}
                      style={{ userSelect: "none" }}
                    >
                      {`${Math.round(v.height * 100) / 100} m`}
                    </text>
                  )}
                </g>
              </g>
            </g>
          );
        }
        const isSelected = selectedVertexIndex === v.vertexIndex;
        const isArc = v.type === "circle";
        const handleProps = {
          fill: isSelected ? color : "#ffffff",
          stroke: color,
          strokeWidth: 1.5,
          "data-elev-handle": "1",
          style: { cursor: "move" },
          onMouseDown: (e) => {
            downRef.current = {
              vertexIndex: v.vertexIndex,
              x: e.clientX,
              y: e.clientY,
              wasSelected: isSelected,
            };
            onSelectVertex?.(v.vertexIndex);
            onVertexMouseDown?.(e, { vertexIndex: v.vertexIndex });
          },
          onClick: (e) => {
            e.stopPropagation();
            const down = downRef.current;
            downRef.current = null;
            if (!down || down.vertexIndex !== v.vertexIndex) return;
            const moved =
              Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3;
            // Re-click on the already-selected vertex (no drag) toggles the
            // vertex type square ↔ circle (arc control point).
            if (!moved && down.wasSelected) {
              onToggleVertexType?.(v.vertexIndex);
            }
          },
        };
        return (
          <g key={`sec-v-${v.vertexIndex}`}>
            <g transform={`translate(${v.s}, ${v.topY})`}>
              <g style={COUNTER_ZOOM}>
                {isArc ? (
                  <circle r={HALF} {...handleProps} />
                ) : (
                  <rect
                    x={-HALF}
                    y={-HALF}
                    width={HALF * 2}
                    height={HALF * 2}
                    {...handleProps}
                  />
                )}
              </g>
            </g>
            {/* height field — hidden by the labels switch, but the SELECTED
                vertex keeps its field so it stays editable */}
            {(showLabels || isSelected) && (
              <g transform={`translate(${v.s}, ${v.topY})`}>
                <g style={COUNTER_ZOOM}>
                  <foreignObject
                    x={-FW / 2}
                    y={-FH - LABEL_GAP}
                    width={FW}
                    height={FH}
                    style={{ overflow: "visible" }}
                  >
                    <FieldElevationOffset
                      label="Δ"
                      value={liveHeight}
                      accentColor={color}
                      onCommit={(val) =>
                        onCommitVertexHeight?.(v.vertexIndex, val)
                      }
                    />
                  </foreignObject>
                </g>
              </g>
            )}
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
              stroke={color}
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
