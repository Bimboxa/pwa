import { useMemo } from "react";

import { GAP_PX, RECAP_PAD_PX } from "../elevationLayout";

import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";
import getZAxisAnchoredLayout from "Features/elevation/utils/getZAxisAnchoredLayout";

import FieldElevationOffset from "./FieldElevationOffset";
import ElevationZeroLine from "./ElevationZeroLine";
import ElevationOffsetField from "./ElevationOffsetField";

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
  // isoHeightLines markers ({index, xA, xB, topY, height}) — one horizontal
  // dashed segment + ONE diamond handle per line (the whole line moves, in
  // BOTH directions: height and position along the axis).
  isoMarkers = [],
  onIsoHandleMouseDown,
  onCommitIsoHeight,
  // iso point selection (click a diamond → select; Delete removes the line)
  selectedIsoIndex = null,
  onSelectIso,
  // profile extremity handles (vertical batch edit of the end heights)
  onExtremityMouseDown,
  onCommitExtremityOffset,
  // add-point snap helper: cursor world position + creation callback
  hoverWorldPos = null,
  onAddIsoPoint,
  // POLYGON surface: show ONLY the top profile projected on the vertical
  // plane — no per-segment quads/bottom line, no "vue de dessus" recap, no
  // grid, no Ht field, TOP handles only.
  surfaceMode = false,
  // hide the iso / extremity height labels (POLYGON surface only; the selected
  // iso keeps its field). The screen-fixed Z axis (world x + side) lets the
  // Z = 0 line reach it and the Offset field sit beside it — used only in
  // surfaceMode (wall mode keeps the legacy far-left placement).
  showLabels = true,
  zAxisWorldX = null,
  zAxisSide = "right",
}) {
  // preview-applied vertices: the dragged handle's vertex, an extremity
  // group, or — for an iso drag — every vertex pinned on the dragged iso line
  // (height AND x), so the connected segments follow in real time.
  const verts = useMemo(() => {
    if (!dragPreview) return vertices;
    if (dragPreview.isoIndex != null) {
      const dx = dragPreview.worldDx || 0;
      return vertices.map((v) =>
        v.isoIndex === dragPreview.isoIndex
          ? { ...v, topY: dragPreview.worldY, x: v.x + dx }
          : v
      );
    }
    if (dragPreview.extremityPointIndexes) {
      const set = new Set(dragPreview.extremityPointIndexes);
      return vertices.map((v) =>
        v.pointIndex != null && set.has(v.pointIndex)
          ? { ...v, topY: dragPreview.worldY }
          : v
      );
    }
    if (dragPreview.pointIndex == null) return vertices;
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

  // preview-applied iso markers (whole line follows the dragged handle, in
  // both directions)
  const markers = useMemo(() => {
    if (!dragPreview || dragPreview.isoIndex == null) return isoMarkers;
    const dx = dragPreview.worldDx || 0;
    return isoMarkers.map((m) =>
      m.index === dragPreview.isoIndex
        ? { ...m, topY: dragPreview.worldY, xA: m.xA + dx, xB: m.xB + dx }
        : m
    );
  }, [isoMarkers, dragPreview]);

  // Surface silhouette (surface mode): the projection of the polygon's top
  // surface on the vertical plane is drawn as ONE line — the upper envelope
  // (highest topY per x) of every projected ring edge. Front/back edges of the
  // closed ring overlap in x; drawing them all would show crossing "return"
  // strokes instead of the surface seen edge-on.
  const silhouette = useMemo(() => {
    // Built from `verts` (preview-applied) so the profile follows handle and
    // iso-line drags in real time.
    if (!surfaceMode || !verts || verts.length < 2) return null;
    const segs = [];
    const xs = new Set();
    for (let j = 0; j < verts.length - 1; j++) {
      const a = verts[j];
      const b = verts[j + 1];
      xs.add(a.x);
      xs.add(b.x);
      if (Math.abs(a.x - b.x) < 1e-9) continue; // edge-on segment: no width
      segs.push([a, b]);
    }
    // Iso lines are ON the surface: their projection constrains the
    // silhouette (fold peak) even where no ring vertex sits on the line. A
    // chord seen edge-on projects to a point — widen it slightly so the
    // sample at its x catches it.
    for (const m of markers) {
      const w = Math.abs(m.xB - m.xA);
      const midX = (m.xA + m.xB) / 2;
      xs.add(midX);
      if (w < 1e-9) {
        segs.push([
          { x: midX - 0.25, topY: m.topY },
          { x: midX + 0.25, topY: m.topY },
        ]);
      } else {
        xs.add(m.xA);
        xs.add(m.xB);
        segs.push([
          { x: m.xA, topY: m.topY },
          { x: m.xB, topY: m.topY },
        ]);
      }
    }
    if (segs.length === 0) return null;
    const sorted = [...xs].sort((u, v) => u - v);
    // Sample at every vertex x + a few interior points per interval, so
    // envelope switches at segment crossings are caught.
    const samples = [];
    for (let i = 0; i < sorted.length; i++) {
      samples.push(sorted[i]);
      if (i < sorted.length - 1) {
        const x0 = sorted[i];
        const x1 = sorted[i + 1];
        for (let k = 1; k <= 4; k++) samples.push(x0 + ((x1 - x0) * k) / 5);
      }
    }
    const pts = [];
    for (const x of samples) {
      let top = Infinity; // screen y: smaller = higher
      for (const [a, b] of segs) {
        const lo = Math.min(a.x, b.x);
        const hi = Math.max(a.x, b.x);
        if (x < lo - 1e-9 || x > hi + 1e-9) continue;
        const t = (x - a.x) / (b.x - a.x);
        const y = a.topY + (b.topY - a.topY) * t;
        if (y < top) top = y;
      }
      if (Number.isFinite(top)) pts.push({ x, y: top });
    }
    return pts.length >= 2 ? pts : null;
  }, [surfaceMode, verts, markers]);

  // Profile extremities (surface mode): the ring vertices sharing the min /
  // max projected x — one vertical handle drives them all (batch offsetTop).
  const extremities = useMemo(() => {
    if (!surfaceMode || !vertices || vertices.length === 0) return [];
    const anchors = vertices.filter((v) => v.pointIndex != null);
    if (anchors.length === 0) return [];
    let minX = Infinity;
    let maxX = -Infinity;
    for (const a of anchors) {
      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
    }
    const TOL = 0.5;
    const make = (x0, key) => {
      const pointIndexes = [
        ...new Set(
          anchors
            .filter((a) => Math.abs(a.x - x0) <= TOL)
            .map((a) => a.pointIndex)
        ),
      ];
      return { key, x: x0, pointIndexes };
    };
    const res = [make(minX, "MIN")];
    if (maxX - minX > TOL) res.push(make(maxX, "MAX"));
    return res;
  }, [surfaceMode, vertices]);

  // Anchor Y for a value label at x: the HIGHEST silhouette point within the
  // label's horizontal footprint, so the label always sits above the strokes
  // (a label anchored on a mid-slope handle would otherwise cross the rising
  // line). Falls back to the handle's own y (wall mode: no silhouette).
  const labelAnchorY = (x, fallbackY) => {
    const pts = silhouette;
    if (!pts || pts.length === 0) return fallbackY;
    const halfW = 44 / zoom; // ~ half label width + margin, in world units
    let top = fallbackY;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x >= x - halfW && p.x <= x + halfW && p.y < top) top = p.y;
      if (i < pts.length - 1) {
        const q = pts[i + 1];
        for (const bx of [x - halfW, x + halfW]) {
          if ((p.x - bx) * (q.x - bx) < 0) {
            const t = (bx - p.x) / (q.x - p.x);
            const y = p.y + (q.y - p.y) * t;
            if (y < top) top = y;
          }
        }
      }
    }
    return top;
  };

  // Y of an extremity handle = highest preview-applied top among its group.
  const extremityY = (ext) => {
    let y = Infinity;
    for (const v of verts) {
      if (v.pointIndex != null && ext.pointIndexes.includes(v.pointIndex)) {
        if (v.topY < y) y = v.topY;
      }
    }
    return Number.isFinite(y) ? y : 0;
  };

  // Add-point snap helper (surface mode): projection of the cursor on the
  // nearest silhouette segment. Shown when the cursor is close (screen px);
  // clicking INSIDE the 8px circle creates a new iso line at that spot.
  // Hidden near an EXISTING handle (iso diamond / extremity circle) so those
  // stay clickable for selection / drag.
  const snapHelper = useMemo(() => {
    if (!surfaceMode || !silhouette || !hoverWorldPos || dragPreview) {
      return null;
    }
    // Existing handles win over creation: no helper when the cursor is close
    // to one of them.
    const NEAR_HANDLE_PX = 14;
    const nearHandle = (hx, hy) =>
      Math.hypot(hoverWorldPos.x - hx, hoverWorldPos.y - hy) * zoom <=
      NEAR_HANDLE_PX;
    for (const m of markers) {
      if (nearHandle((m.xA + m.xB) / 2, m.topY)) return null;
    }
    for (const ext of extremities) {
      let y = Infinity;
      for (const v of verts) {
        if (v.pointIndex != null && ext.pointIndexes.includes(v.pointIndex)) {
          if (v.topY < y) y = v.topY;
        }
      }
      if (Number.isFinite(y) && nearHandle(ext.x, y)) return null;
    }
    const proj = projectPointOnPolyline(
      { x: hoverWorldPos.x, y: hoverWorldPos.y },
      silhouette.map((p) => ({ x: p.x, y: p.y }))
    );
    if (!proj) return null;
    const screenDist = proj.distance * zoom;
    if (screenDist > 24) return null;
    return { x: proj.projected.x, y: proj.projected.y };
  }, [
    surfaceMode,
    silhouette,
    hoverWorldPos,
    dragPreview,
    zoom,
    markers,
    extremities,
    verts,
  ]);

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

  // Z = 0 line reaches the screen-fixed Z axis in surfaceMode (POLYGON iso;
  // wall mode has no axis). The Offset field stays FAR-LEFT of the profile
  // (`offsetPlacement: "left"`): the axis-side endpoint + its Δ field would
  // otherwise collide with an axis-anchored offset on a full-width silhouette.
  const layout = getZAxisAnchoredLayout({
    xMin,
    xMax,
    xPad,
    zAxisWorldX: surfaceMode ? zAxisWorldX : null,
    zAxisSide,
    offsetPlacement: "left",
  });

  return (
    <g>
      {/* white background band behind the "vue de dessus" recap */}
      {!surfaceMode && (
        <rect
          x={xMin - xPad}
          y={recapBandTop}
          width={xMax - xMin + xPad * 2}
          height={recapBandBottom - recapBandTop}
          fill="#ffffff"
          stroke="none"
        />
      )}

      {/* "Vue de dessus" label, left side, vertically centered on the band */}
      {!surfaceMode && (
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
      )}

      {/* vertical separations: grey (dashed) outside the surface, primary
          (dashed) across the surface. Only on real anchors — sampled arc
          points would otherwise draw a separation at every curve sample. */}
      {!surfaceMode &&
        verts.map((v) => {
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
      {!surfaceMode &&
        verts.slice(0, -1).map((v, j) => {
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
      {!surfaceMode &&
        verts.map((v, j) =>
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

      {/* elevation. Surface mode (POLYGON): ONE line — the silhouette of the
          surface projected on the vertical plane (upper envelope of the ring
          edges). Wall mode (POLYLINE): per-segment quads, edited band in the
          primary color, neighbours clarified. */}
      {surfaceMode && silhouette && (
        <polyline
          points={silhouette.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {!surfaceMode &&
        verts.slice(0, -1).map((v, j) => {
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

      {/* Z = 0 reference plane (background); the Offset field is drawn LAST */}
      <ElevationZeroLine layout={layout} />

      {/* height field, on the far left at mid-wall level (primary color) —
          hidden in surface mode (a surface has no wall height) */}
      {!surfaceMode && (
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
      )}

      {/* isoHeightLines: one dashed purple segment + ONE diamond handle at the
          midpoint + height field per line — dragging moves the whole line */}
      {markers.map((m) => {
        const ISO_COLOR = "#9c27b0";
        const midX = (m.xA + m.xB) / 2;
        // live height (meters) from the marker's screen Y (same math as TOP)
        const liveHeight = -m.topY * meterByPx - height - offsetZ;
        const FW = 66;
        const FH = 22;
        return (
          <g key={`iso-${m.index}`}>
            <line
              x1={m.xA}
              y1={m.topY}
              x2={m.xB}
              y2={m.topY}
              stroke={ISO_COLOR}
              strokeWidth={2}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <g transform={`translate(${midX}, ${m.topY})`}>
              <g style={COUNTER_ZOOM}>
                <rect
                  x={-HALF}
                  y={-HALF}
                  width={HALF * 2}
                  height={HALF * 2}
                  transform="rotate(45)"
                  fill={selectedIsoIndex === m.index ? ISO_COLOR : "#ffffff"}
                  stroke={ISO_COLOR}
                  strokeWidth={1.5}
                  data-elev-handle="1"
                  data-iso-index={m.index}
                  style={{ cursor: "move" }}
                  onMouseDown={(e) => {
                    onSelectIso?.(m.index);
                    onIsoHandleMouseDown?.(e, m.index);
                  }}
                />
              </g>
            </g>
            {/* value label above the handle — hidden by the labels switch,
                but the SELECTED iso keeps its field so it stays editable */}
            {(showLabels || selectedIsoIndex === m.index) && (
              <g
                transform={`translate(${midX}, ${labelAnchorY(midX, m.topY)})`}
              >
                <g style={COUNTER_ZOOM}>
                  <foreignObject
                    x={-FW / 2}
                    y={-FH - 10}
                    width={FW}
                    height={FH}
                    style={{ overflow: "visible" }}
                  >
                    <FieldElevationOffset
                      label="Iso"
                      value={liveHeight}
                      accentColor={ISO_COLOR}
                      onCommit={(val) => onCommitIsoHeight?.(m.index, val)}
                    />
                  </foreignObject>
                </g>
              </g>
            )}
          </g>
        );
      })}

      {/* profile extremity handles (surface mode): one circle per end of the
          silhouette — vertical drag (or the field) edits the offsetTop of
          every ring vertex sharing that projected x */}
      {extremities.map((ext) => {
        const y = extremityY(ext);
        // live height (meters) from the handle's screen Y (TOP semantics)
        const liveHeight = -y * meterByPx - height - offsetZ;
        const FW = 66;
        const FH = 22;
        return (
          <g key={`ext-${ext.key}`}>
            <g transform={`translate(${ext.x}, ${y})`}>
              <g style={COUNTER_ZOOM}>
                <circle
                  r={HALF}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={1.5}
                  data-elev-handle="1"
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={(e) =>
                    onExtremityMouseDown?.(e, ext.pointIndexes)
                  }
                />
              </g>
            </g>
            {/* value label above the handle — hidden by the labels switch */}
            {showLabels && (
              <g transform={`translate(${ext.x}, ${labelAnchorY(ext.x, y)})`}>
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
                      accentColor={color}
                      onCommit={(val) =>
                        onCommitExtremityOffset?.(ext.pointIndexes, val)
                      }
                    />
                  </foreignObject>
                </g>
              </g>
            )}
          </g>
        );
      })}

      {/* add-point snap helper: 8px circle on the nearest silhouette segment;
          clicking inside it creates a new iso line at that spot */}
      {snapHelper && (
        <g transform={`translate(${snapHelper.x}, ${snapHelper.y})`}>
          <g style={COUNTER_ZOOM}>
            <circle
              r={4}
              fill="rgba(156, 39, 176, 0.25)"
              stroke="#9c27b0"
              strokeWidth={1.5}
              data-elev-handle="1"
              style={{ cursor: "copy" }}
              onClick={(e) => {
                e.stopPropagation();
                onAddIsoPoint?.(snapHelper.x, snapHelper.y);
              }}
            />
          </g>
        </g>
      )}

      {/* handles: only the edited segment's two vertices. Hidden in surface
          mode — the surface silhouette is edited through the iso-line helpers
          only. */}
      {!surfaceMode &&
        selA &&
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

      {/* offset fields: minimalist inputs fixed to the edited segment's
          vertices (top/bottom), constant screen size. Hidden in surface mode. */}
      {!surfaceMode &&
        selA &&
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

      {/* Offset field LAST → on top of the silhouette / handles / labels */}
      <ElevationOffsetField
        layout={layout}
        offsetZ={offsetZ}
        onCommitOffsetZ={onCommitOffsetZ}
      />
    </g>
  );
}
