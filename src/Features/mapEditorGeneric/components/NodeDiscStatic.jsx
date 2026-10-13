import { useMemo } from "react";
import { darken } from "@mui/material/styles";

import theme from "Styles/theme";
import getRevolutionAxisPlanFrame from "Features/annotations/utils/getRevolutionAxisPlanFrame";
import { getDiscSector } from "Features/annotations/utils/discGeometry";
import { angleToPx } from "Features/annotations/utils/revolutionAxisGlyph";
import { circleFromThreePoints } from "Features/geometry/utils/arcSampling";

// DISC annotation: a filled disc — or the kept sector of a partial
// revolution — drawn from its CENTRE (`point`) + `radiusM` (+ the two sector
// bounds, see discGeometry), minus its openings (`cuts`, same storage as a
// POLYGON's holes: db.points rings, S-C-S arcs allowed). The outline is a
// 1 px screen-constant stroke in the fill colour.
//
// Interaction mirrors the plan-view revolution axis (NodeRevolutionAxisStatic):
// - the body is draggable as a whole (the centre moves, snapping onto the
//   drawn points — InteractionLayer MARKER_LIKE_SNAP_DRAG_TYPES);
// - selected, full disc: a handle at each end of the horizontal diameter
//   sets the RADIUS (REVOLUTION_RIM::<0|1>);
// - selected, partial: the two radii bounding the sector, dotted, with a
//   handle at each sector end that sets that bound AND the radius
//   (REVOLUTION_ANGLE::<START|END>);
// - selected: each opening is a selectable part (`{id}::CUT::{i}`, Suppr
//   removes it) and its vertices are draggable (usePointDrag).
// The handle maths lives in applyDeltaPosToAnnotation (shared with the axis).
const HANDLE_PX = 5;
const CROSS_PX = 6;
const CENTER_HIT_PX = 9;
const VERTEX_PX = 4;
const CUT_SELECTED_COLOR = "#2196f3";

// SVG path of a closed ring with S-C-S arcs (square → circle → square = the
// circular arc through the three points), in screen (y-down) pixels.
function ringPathD(points) {
  const n = points?.length ?? 0;
  if (n < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  let i = 0;
  while (i < n) {
    const p0 = points[i % n];
    const p1 = points[(i + 1) % n];
    const p2 = points[(i + 2) % n];
    if (p0.type !== "circle" && p1?.type === "circle" && p2) {
      const circle = circleFromThreePoints(p0, p1, p2);
      if (circle) {
        const { center: c, r } = circle;
        const cross =
          (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        const cw = cross > 0; // clockwise on screen (y down) = SVG sweep 1
        const a0 = Math.atan2(p0.y - c.y, p0.x - c.x);
        const a2 = Math.atan2(p2.y - c.y, p2.x - c.x);
        let delta = cw ? a2 - a0 : a0 - a2;
        delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const largeArc = delta > Math.PI ? 1 : 0;
        d += ` A ${r} ${r} 0 ${largeArc} ${cw ? 1 : 0} ${p2.x} ${p2.y}`;
        i += 2;
        continue;
      }
    }
    if (i + 1 <= n) d += ` L ${p1.x} ${p1.y}`;
    i += 1;
  }
  return `${d} Z`;
}

export default function NodeDiscStatic({
  annotation,
  annotationOverride,
  selected,
  hovered,
  dragged,
  selectedPartId,
  selectedPointId,
  selectedPointIds,
  containerK = 1,
  baseMapMeterByPx,
}) {
  const mergedAnnotation = { ...annotation, ...annotationOverride };

  const { id, listingId, fillColor, fillOpacity, radiusM } = mergedAnnotation;

  // Robust position read: drag puts x/y at the root, the DB stores point.x/y.
  const centerPx = useMemo(
    () => ({
      x: mergedAnnotation.x ?? mergedAnnotation.point?.x ?? 0,
      y: mergedAnnotation.y ?? mergedAnnotation.point?.y ?? 0,
    }),
    [mergedAnnotation.x, mergedAnnotation.y, mergedAnnotation.point]
  );

  // Same frame as the axis, with no diameter orientation (direction 0): the
  // rim handles sit on the horizontal diameter.
  const frame = useMemo(
    () =>
      getRevolutionAxisPlanFrame({
        centerPx,
        radiusM,
        directionDeg: 0,
        meterByPx: baseMapMeterByPx,
      }),
    [centerPx, radiusM, baseMapMeterByPx]
  );

  const sector = useMemo(
    () => getDiscSector(mergedAnnotation),
    [
      mergedAnnotation.partialRevolution,
      mergedAnnotation.revolutionAngleStartDeg,
      mergedAnnotation.revolutionAngleEndDeg,
    ]
  );

  // Openings: one path each (evenodd fill), one selectable part each.
  const holesData = useMemo(
    () =>
      (mergedAnnotation.cuts ?? [])
        .map((cut, i) => ({
          index: i,
          points: cut?.points ?? [],
          d: ringPathD(cut?.points ?? []),
          partId: `${id}::CUT::${i}`,
        }))
        .filter((h) => h.points.length >= 3),
    [mergedAnnotation.cuts, id]
  );

  // Screen-constant sizes: counter the map zoom and the container scale.
  const k = containerK || 1;
  const scaleTransform = useMemo(
    () => `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`,
    [k]
  );

  if (!frame) return null;

  const { radiusPx, rimPx } = frame;
  const color = fillColor || theme.palette.secondary.main;
  const opacity = fillOpacity ?? 0.8;
  const active = selected || dragged;
  const paint = hovered && !active ? darken(color, 0.2) : color;

  // Fill path. Full disc: two half circles (an SVG arc can't be a full
  // circle). Sector: centre → start, arc to end (CCW in the local frame =
  // sweep 0 on screen, see contourArcPath), back to the centre.
  let fillD;
  if (!sector.isSector) {
    const [a, b] = rimPx;
    fillD =
      `M ${a.x} ${a.y} A ${radiusPx} ${radiusPx} 0 0 0 ${b.x} ${b.y} ` +
      `A ${radiusPx} ${radiusPx} 0 0 0 ${a.x} ${a.y} Z`;
  } else {
    const s = angleToPx(centerPx, radiusPx, sector.start);
    const e = angleToPx(centerPx, radiusPx, sector.end);
    const largeArc = sector.span > Math.PI ? 1 : 0;
    fillD =
      `M ${centerPx.x} ${centerPx.y} L ${s.x} ${s.y} ` +
      `A ${radiusPx} ${radiusPx} 0 ${largeArc} 0 ${e.x} ${e.y} Z`;
  }
  const fullFillD = [fillD, ...holesData.map((h) => h.d)].join(" ");

  const sectorBounds = sector.isSector
    ? [
        { key: "START", pt: angleToPx(centerPx, radiusPx, sector.start) },
        { key: "END", pt: angleToPx(centerPx, radiusPx, sector.end) },
      ]
    : [];

  const dataProps = {
    "data-node-id": id,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "DISC",
    "data-interaction": "draggable",
  };

  const renderHandle = (pt, partType, key) => (
    <g key={key} transform={`translate(${pt.x}, ${pt.y})`}>
      <g style={{ transform: scaleTransform }}>
        <rect
          x={-HANDLE_PX}
          y={-HANDLE_PX}
          width={HANDLE_PX * 2}
          height={HANDLE_PX * 2}
          fill="#FFFFFF"
          stroke={color}
          strokeWidth={1.5}
          style={{ cursor: "grab" }}
          data-interaction="draggable"
          data-node-id={id}
          data-node-type="ANNOTATION"
          data-part-type={partType}
        />
      </g>
    </g>
  );

  // Vertex of an opening: same DOM contract as NodePolylineStatic so
  // usePointDrag / the snap pipeline drive it (db.points row).
  const renderCutVertex = (pt, cutIndex) => {
    const isPointSelected =
      selectedPointId === pt.id || selectedPointIds?.includes(pt.id);
    const stroke = isPointSelected ? CUT_SELECTED_COLOR : darken(color, 0.3);
    return (
      <g
        key={`cut-${cutIndex}-${pt.id}`}
        transform={`translate(${pt.x}, ${pt.y})`}
        style={{ cursor: "pointer", pointerEvents: "all" }}
        data-node-type="VERTEX"
        data-point-id={pt.id}
        data-annotation-id={id}
        data-cut-index={cutIndex}
      >
        <g style={{ transform: scaleTransform }}>
          {pt.type === "circle" ? (
            <circle
              r={VERTEX_PX}
              fill="#FFFFFF"
              stroke={stroke}
              strokeWidth={1.5}
            />
          ) : (
            <rect
              x={-VERTEX_PX}
              y={-VERTEX_PX}
              width={VERTEX_PX * 2}
              height={VERTEX_PX * 2}
              fill="#FFFFFF"
              stroke={stroke}
              strokeWidth={1.5}
            />
          )}
        </g>
      </g>
    );
  };

  return (
    <g
      style={{
        cursor: dragged ? "grabbing" : selected ? "move" : "pointer",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      {/* Body: fill (openings subtracted) + 1 px screen-constant outline in
          the fill colour */}
      <path
        d={fullFillD}
        fill={paint}
        fillOpacity={opacity}
        fillRule="evenodd"
        stroke={paint}
        strokeWidth={active ? 1.5 : 1}
        vectorEffect="non-scaling-stroke"
        data-part-type="MAIN"
      />

      {/* Openings: hit area + selection feedback (selected only) */}
      {selected &&
        !dragged &&
        holesData.map((hole) => {
          const isSelected = selectedPartId === hole.partId;
          return (
            <path
              key={`hole-${hole.index}`}
              d={hole.d}
              fill={isSelected ? CUT_SELECTED_COLOR : color}
              fillOpacity={isSelected ? 0.3 : 0.1}
              stroke="none"
              style={{ cursor: "pointer" }}
              data-part-id={hole.partId}
              data-part-type="CUT"
              data-node-id={id}
            />
          );
        })}

      {/* Radii bounding the sector (selected only) */}
      {active &&
        sectorBounds.map(({ key, pt }) => (
          <line
            key={`radius-${key}`}
            x1={centerPx.x}
            y1={centerPx.y}
            x2={pt.x}
            y2={pt.y}
            stroke={darken(color, 0.3)}
            strokeWidth={1.5}
            strokeDasharray="1 5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

      {/* Centre: a fat transparent hit area, plus a cross once selected */}
      <g transform={`translate(${centerPx.x}, ${centerPx.y})`}>
        <g style={{ transform: scaleTransform }}>
          <circle cx={0} cy={0} r={CENTER_HIT_PX} fill="transparent" />
          {active && (
            <>
              <line
                x1={-CROSS_PX}
                y1={0}
                x2={CROSS_PX}
                y2={0}
                stroke={darken(color, 0.3)}
                strokeWidth={1.5}
              />
              <line
                x1={0}
                y1={-CROSS_PX}
                x2={0}
                y2={CROSS_PX}
                stroke={darken(color, 0.3)}
                strokeWidth={1.5}
              />
            </>
          )}
        </g>
      </g>

      {selected && !dragged && (
        <>
          {/* Full disc: radius handles at the diameter ends */}
          {!sector.isSector &&
            rimPx.map((pt, i) =>
              renderHandle(pt, `REVOLUTION_RIM::${i}`, `rim-${i}`)
            )}

          {/* Partial: sector bound (+ radius) handles */}
          {sectorBounds.map(({ key, pt }) =>
            renderHandle(pt, `REVOLUTION_ANGLE::${key}`, `angle-${key}`)
          )}

          {/* Opening vertices */}
          {holesData.flatMap((hole) =>
            hole.points.map((pt) => renderCutVertex(pt, hole.index))
          )}
        </>
      )}
    </g>
  );
}
