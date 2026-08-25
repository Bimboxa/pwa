import { useMemo } from "react";

import theme from "Styles/theme";

// A plan revolution axis instantiated on a VERTICAL base map: an inverted "T" —
// the orange DIAMETER of the plan circle laid horizontally, the black dashed
// AXIS rising from the centre over the axis height, and the centre dot.
//
// Placing this node is what poses the base map in 3D (the plane is rotated so
// it contains the axis), so the drawing reads as the section trace of the plan
// circle: the orange bar is exactly the plan diameter seen edge-on.
//
// `revolutionAxisRadiusM` / `revolutionAxisHeightM` are resolved upstream by
// useAnnotationsV2 (they live on the linked plan axis, on another base map).
const BLACK = "#000000";
const CENTER_DOT_PX = 3.5;
const HIT_STROKE_PX = 12;
const FALLBACK_HALF_PX = 60;
const FALLBACK_HEIGHT_PX = 150;

export default function NodeRevolutionAxisPlacementStatic({
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
    revolutionAxisRadiusM,
    revolutionAxisHeightM,
  } = mergedAnnotation;

  // Robust position read: drag puts x/y at the root, the DB stores point.x/y.
  const cx = mergedAnnotation.x ?? mergedAnnotation.point?.x ?? 0;
  const cy = mergedAnnotation.y ?? mergedAnnotation.point?.y ?? 0;

  const hasScale = Number.isFinite(baseMapMeterByPx) && baseMapMeterByPx > 0;

  const { halfPx, heightPx } = useMemo(() => {
    const r = Number(revolutionAxisRadiusM);
    const h = Number(revolutionAxisHeightM);
    return {
      halfPx:
        hasScale && Number.isFinite(r) && r > 0
          ? r / baseMapMeterByPx
          : FALLBACK_HALF_PX,
      heightPx:
        hasScale && Number.isFinite(h) && h > 0
          ? h / baseMapMeterByPx
          : FALLBACK_HEIGHT_PX,
    };
  }, [
    revolutionAxisRadiusM,
    revolutionAxisHeightM,
    hasScale,
    baseMapMeterByPx,
  ]);

  const k = containerK || 1;
  const scaleTransform = useMemo(
    () => `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`,
    [k]
  );

  const orange = strokeColor || theme.palette.secondary.main;
  const strokeW = selected || hovered ? 3 : 2;

  const dataProps = {
    "data-node-id": id,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "REVOLUTION_AXIS_PLACEMENT",
    "data-interaction": "draggable",
  };

  return (
    <g
      style={{
        cursor: dragged ? "grabbing" : "crosshair",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      {/* Fat transparent hit areas over both bars. */}
      <line
        x1={cx - halfPx}
        y1={cy}
        x2={cx + halfPx}
        y2={cy}
        stroke="transparent"
        strokeWidth={HIT_STROKE_PX}
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - heightPx}
        stroke="transparent"
        strokeWidth={HIT_STROKE_PX}
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
      />

      {/* The revolution axis itself, rising over `height` metres. */}
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - heightPx}
        stroke={BLACK}
        strokeWidth={strokeW}
        strokeDasharray="8 5"
        vectorEffect="non-scaling-stroke"
      />

      {/* The plan diameter, seen edge-on. */}
      <line
        x1={cx - halfPx}
        y1={cy}
        x2={cx + halfPx}
        y2={cy}
        stroke={orange}
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
      />

      {/* Centre */}
      <g transform={`translate(${cx}, ${cy})`}>
        <g style={{ transform: scaleTransform }}>
          <circle cx={0} cy={0} r={CENTER_DOT_PX} fill={BLACK} />
          {selected && (
            <circle
              cx={0}
              cy={0}
              r={CENTER_DOT_PX + 4}
              fill="none"
              stroke={orange}
              strokeWidth={1.5}
            />
          )}
        </g>
      </g>
    </g>
  );
}
