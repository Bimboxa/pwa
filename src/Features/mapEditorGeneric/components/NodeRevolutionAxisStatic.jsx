import { useMemo } from "react";

import theme from "Styles/theme";
import getRevolutionAxisPlanFrame from "Features/annotations/utils/getRevolutionAxisPlanFrame";
import {
  halfArcPath,
  SWEEP_ORANGE,
  SWEEP_BLACK,
} from "Features/annotations/utils/revolutionAxisGlyph";

// Plan-view revolution axis: a circle split by its diameter into two halves —
// the ORANGE one is what lies BEHIND the vertical base map this axis places
// (matching the default half-revolution the 3D shows), the black one in front.
// Plus the orange diameter and a black centre dot.
//
// Selected, it grows two square handles at the diameter ends (drag = radius +
// orientation, centre fixed) and, when the axis carries a partial revolution,
// two round handles for the sector bounds.
const BLACK = "#000000";
const HANDLE_PX = 5;
const CENTER_DOT_PX = 3.5;
const ANGLE_HANDLE_PX = 5.5;
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

  const orange = strokeColor || theme.palette.secondary.main;

  const sector = useMemo(() => {
    if (!partialRevolution || !frame) return null;
    const toPx = (deg) => {
      // Sector angles share the axis convention: local metre frame, y up.
      const t = ((Number(deg) || 0) * Math.PI) / 180;
      return {
        x: frame.centerPx.x + frame.radiusPx * Math.cos(t),
        y: frame.centerPx.y - frame.radiusPx * Math.sin(t),
      };
    };
    return {
      start: toPx(revolutionAngleStartDeg),
      end: toPx(revolutionAngleEndDeg),
    };
  }, [
    partialRevolution,
    frame,
    revolutionAngleStartDeg,
    revolutionAngleEndDeg,
  ]);

  if (!frame) return null;

  const { radiusPx, rimPx } = frame;
  const [rimA, rimB] = rimPx;

  const dataProps = {
    "data-node-id": id,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "REVOLUTION_AXIS",
    "data-interaction": "draggable",
  };

  const strokeW = selected || hovered ? 3 : 2;

  return (
    <g
      style={{
        cursor: dragged ? "grabbing" : "crosshair",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      {/* Fat transparent hit ring — the whole axis is grabbable. */}
      <circle
        cx={centerPx.x}
        cy={centerPx.y}
        r={radiusPx}
        fill="transparent"
        stroke="transparent"
        strokeWidth={HIT_STROKE_PX}
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
      />

      {/* The two half-discs. `orangePx` is the +90°-CCW side of the diameter in
          the plan LOCAL frame, which is provably the −normal (behind) side of
          the placed plane — see getRevolutionAxisPlanFrame. */}
      <path
        d={halfArcPath(rimA, rimB, radiusPx, SWEEP_ORANGE)}
        fill="none"
        stroke={orange}
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={halfArcPath(rimA, rimB, radiusPx, SWEEP_BLACK)}
        fill="none"
        stroke={BLACK}
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
      />

      {/* Diameter */}
      <line
        x1={rimA.x}
        y1={rimA.y}
        x2={rimB.x}
        y2={rimB.y}
        stroke={orange}
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
      />

      {/* Centre dot */}
      <g transform={`translate(${centerPx.x}, ${centerPx.y})`}>
        <g style={{ transform: scaleTransform }}>
          <circle cx={0} cy={0} r={CENTER_DOT_PX} fill={BLACK} />
        </g>
      </g>

      {/* Diameter handles — drag keeps the centre fixed. */}
      {selected &&
        !dragged &&
        [rimA, rimB].map((pt, i) => (
          <g key={`rim-${i}`} transform={`translate(${pt.x}, ${pt.y})`}>
            <g style={{ transform: scaleTransform }}>
              <rect
                x={-HANDLE_PX}
                y={-HANDLE_PX}
                width={HANDLE_PX * 2}
                height={HANDLE_PX * 2}
                fill="#FFFFFF"
                stroke={BLACK}
                strokeWidth={1.5}
                style={{ cursor: "crosshair" }}
                data-interaction="draggable"
                data-node-id={id}
                data-node-type="ANNOTATION"
                data-part-type={`REVOLUTION_RIM::${i}`}
              />
            </g>
          </g>
        ))}

      {/* Partial-revolution sector bounds */}
      {selected &&
        !dragged &&
        sector &&
        [
          { key: "START", pt: sector.start },
          { key: "END", pt: sector.end },
        ].map(({ key, pt }) => (
          <g key={`angle-${key}`}>
            <line
              x1={centerPx.x}
              y1={centerPx.y}
              x2={pt.x}
              y2={pt.y}
              stroke="#1976d2"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
            <g transform={`translate(${pt.x}, ${pt.y})`}>
              <g style={{ transform: scaleTransform }}>
                <circle
                  cx={0}
                  cy={0}
                  r={ANGLE_HANDLE_PX}
                  fill="#1976d2"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  style={{ cursor: "crosshair" }}
                  data-interaction="draggable"
                  data-node-id={id}
                  data-node-type="ANNOTATION"
                  data-part-type={`REVOLUTION_ANGLE::${key}`}
                />
              </g>
            </g>
          </g>
        ))}
    </g>
  );
}
