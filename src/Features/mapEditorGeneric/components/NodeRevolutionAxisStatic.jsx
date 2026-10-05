import { useMemo } from "react";

import theme from "Styles/theme";
import getRevolutionAxisPlanFrame from "Features/annotations/utils/getRevolutionAxisPlanFrame";
import {
  angleToPx,
  contourArcPath,
  getRevolutionAxisContourArcs,
  CUT_AXIS_OVERSHOOT,
} from "Features/annotations/utils/revolutionAxisGlyph";
import { CURSOR_ROTATE } from "../utils/rotateCursor";

// Plan-view revolution axis.
//
// The CONTOUR is the circle of the axis — or, for a partial revolution, its
// kept sector only. The 3D half-view ("Demi-vue 3D") cuts along the diameter
// and shows the half BEHIND the vertical base map this axis places: that half
// of the contour is VISIBLE, the other one HIDDEN (see
// getRevolutionAxisContourArcs). Half-view off → the whole contour is visible.
//
// - Not selected: a cross at the centre + the contour (visible = axis colour,
//   hidden = grey).
// - Selected (or being dragged — the transient copy drawn during a drag is
//   not flagged `selected`): the contour in the axis colour (visible = thick, hidden = thin)
//   and the CUT AXIS in blue, overshooting the circle, with a square handle at
//   each end to ROTATE the axis (REVOLUTION_RIM::ROTATE<0|1>, centre and
//   radius fixed).
//   · Full revolution: a handle at each diameter end sets the RADIUS
//     (REVOLUTION_RIM::<0|1>, direction fixed).
//   · Partial revolution: the two radii bounding the sector, dotted (thick on
//     the visible side, thin on the hidden one), with a handle at each sector
//     end that sets that bound AND the radius (REVOLUTION_ANGLE::<START|END>).
const BLUE = "#1976d2";
const GREY = "#bdbdbd";
const DEG = Math.PI / 180;
const HANDLE_PX = 5;
const CROSS_PX = 7;
const CENTER_HIT_PX = 9;
const HIT_STROKE_PX = 12;

export default function NodeRevolutionAxisStatic({
  annotation,
  annotationOverride,
  selected,
  hovered,
  dragged,
  containerK = 1,
  baseMapMeterByPx,
}) {
  const mergedAnnotation = { ...annotation, ...annotationOverride };

  const {
    id,
    listingId,
    strokeColor,
    radiusM,
    directionDeg,
    invertHalf,
    partialRevolution,
    revolutionAngleStartDeg,
    revolutionAngleEndDeg,
    halfViewIn3d,
  } = mergedAnnotation;

  // Robust position read: drag puts x/y at the root, the DB stores point.x/y.
  const centerPx = useMemo(
    () => ({
      x: mergedAnnotation.x ?? mergedAnnotation.point?.x ?? 0,
      y: mergedAnnotation.y ?? mergedAnnotation.point?.y ?? 0,
    }),
    [mergedAnnotation.x, mergedAnnotation.y, mergedAnnotation.point]
  );

  const frame = useMemo(
    () =>
      getRevolutionAxisPlanFrame({
        centerPx,
        radiusM,
        directionDeg,
        invertHalf,
        meterByPx: baseMapMeterByPx,
      }),
    [centerPx, radiusM, directionDeg, invertHalf, baseMapMeterByPx]
  );

  // Screen-constant sizes: counter the map zoom and the container scale.
  const k = containerK || 1;
  const scaleTransform = useMemo(
    () => `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`,
    [k]
  );

  const isPartial = Boolean(partialRevolution);
  // The cut axis only exists while the 3D half-view is on: without it nothing
  // is cut, so neither the blue line nor its rotation handles are drawn.
  const hasCutAxis = halfViewIn3d !== false;
  // Sector angles share the axis convention: local metre frame, y up.
  const angleStart = (Number(revolutionAngleStartDeg) || 0) * DEG;
  const angleEnd = (Number(revolutionAngleEndDeg) || 0) * DEG;

  const arcs = useMemo(
    () =>
      frame
        ? getRevolutionAxisContourArcs({
            theta: frame.theta,
            halfView: hasCutAxis,
            partial: isPartial,
            angleStart,
            angleEnd,
          })
        : [],
    [frame, hasCutAxis, isPartial, angleStart, angleEnd]
  );

  if (!frame) return null;

  const { radiusPx, rimPx, dirPx } = frame;
  const color = strokeColor || theme.palette.secondary.main;

  const dataProps = {
    "data-node-id": id,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "REVOLUTION_AXIS",
    "data-interaction": "draggable",
  };

  // The transient copy rendered while dragging (a handle or the whole axis)
  // keeps the selected look: the cut axis must stay visible while it turns.
  const active = selected || dragged;
  const thickW = active || hovered ? 3 : 2.5;
  const thinW = 1;

  // Cut axis: the diameter, overshooting the circle on both sides.
  const cutEnds = [1, -1].map((sign) => ({
    x: centerPx.x + sign * CUT_AXIS_OVERSHOOT * radiusPx * dirPx.x,
    y: centerPx.y + sign * CUT_AXIS_OVERSHOOT * radiusPx * dirPx.y,
  }));

  // Sector bounds (partial revolution): each radius takes the visibility of
  // the contour piece it ends.
  const sectorBounds =
    isPartial && arcs.length > 0
      ? [
          {
            key: "START",
            pt: angleToPx(centerPx, radiusPx, angleStart),
            visible: arcs[0].visible,
          },
          {
            key: "END",
            pt: angleToPx(centerPx, radiusPx, angleEnd),
            visible: arcs[arcs.length - 1].visible,
          },
        ]
      : [];

  // Cursors: rotation for the cut axis handles; an open hand for the radius
  // / sector handles (useAnnotationDrag forces a crosshair while they are
  // dragged, for a precise positioning).
  const renderHandle = (pt, partType, stroke, key, cursor) => (
    <g key={key} transform={`translate(${pt.x}, ${pt.y})`}>
      <g style={{ transform: scaleTransform }}>
        <rect
          x={-HANDLE_PX}
          y={-HANDLE_PX}
          width={HANDLE_PX * 2}
          height={HANDLE_PX * 2}
          fill="#FFFFFF"
          stroke={stroke}
          strokeWidth={1.5}
          style={{ cursor }}
          data-interaction="draggable"
          data-node-id={id}
          data-node-type="ANNOTATION"
          data-part-type={partType}
        />
      </g>
    </g>
  );

  return (
    <g
      style={{
        // Body: a move-drag zone once selected.
        cursor: dragged ? "grabbing" : selected ? "move" : "pointer",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      {/* Fat transparent hit areas — the contour and the centre cross are
          grabbable. */}
      {arcs.map((arc, i) => (
        <path
          key={`hit-${i}`}
          d={contourArcPath(centerPx, radiusPx, arc)}
          fill="none"
          stroke="transparent"
          strokeWidth={HIT_STROKE_PX}
          vectorEffect="non-scaling-stroke"
          pointerEvents="stroke"
        />
      ))}
      <g transform={`translate(${centerPx.x}, ${centerPx.y})`}>
        <g style={{ transform: scaleTransform }}>
          <circle cx={0} cy={0} r={CENTER_HIT_PX} fill="transparent" />
        </g>
      </g>

      {/* Cut axis of the 3D half-view (selected only) */}
      {active && hasCutAxis && (
        <line
          x1={cutEnds[0].x}
          y1={cutEnds[0].y}
          x2={cutEnds[1].x}
          y2={cutEnds[1].y}
          stroke={BLUE}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Contour: hidden pieces first so the visible ones stay on top at the
          junctions. */}
      {[false, true].map((visible) =>
        arcs
          .filter((arc) => arc.visible === visible)
          .map((arc, i) => (
            <path
              key={`arc-${visible ? "v" : "h"}-${i}`}
              d={contourArcPath(centerPx, radiusPx, arc)}
              fill="none"
              stroke={visible || active ? color : GREY}
              strokeWidth={visible ? thickW : thinW}
              vectorEffect="non-scaling-stroke"
            />
          ))
      )}

      {/* Radii bounding the sector of a partial revolution (selected only) */}
      {active &&
        sectorBounds.map(({ key, pt, visible }) => (
          <line
            key={`radius-${key}`}
            x1={centerPx.x}
            y1={centerPx.y}
            x2={pt.x}
            y2={pt.y}
            stroke={color}
            strokeWidth={visible ? thickW : thinW}
            strokeDasharray={visible ? "1 6" : "1 4"}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

      {/* Centre cross — screen-constant */}
      <g transform={`translate(${centerPx.x}, ${centerPx.y})`}>
        <g style={{ transform: scaleTransform }}>
          <line
            x1={-CROSS_PX}
            y1={0}
            x2={CROSS_PX}
            y2={0}
            stroke={color}
            strokeWidth={1.5}
          />
          <line
            x1={0}
            y1={-CROSS_PX}
            x2={0}
            y2={CROSS_PX}
            stroke={color}
            strokeWidth={1.5}
          />
        </g>
      </g>

      {selected && !dragged && (
        <>
          {/* Rotation handles, at the ends of the cut axis */}
          {hasCutAxis &&
            cutEnds.map((pt, i) =>
              renderHandle(
                pt,
                `REVOLUTION_RIM::ROTATE${i}`,
                BLUE,
                `rotate-${i}`,
                CURSOR_ROTATE
              )
            )}

          {/* Full revolution: radius handles at the diameter ends */}
          {!isPartial &&
            rimPx.map((pt, i) =>
              renderHandle(
                pt,
                `REVOLUTION_RIM::${i}`,
                color,
                `rim-${i}`,
                "grab"
              )
            )}

          {/* Partial revolution: sector bound (+ radius) handles */}
          {sectorBounds.map(({ key, pt }) =>
            renderHandle(
              pt,
              `REVOLUTION_ANGLE::${key}`,
              color,
              `angle-${key}`,
              "grab"
            )
          )}
        </>
      )}
    </g>
  );
}
