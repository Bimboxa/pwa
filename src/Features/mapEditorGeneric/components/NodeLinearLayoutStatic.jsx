import { memo, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

import {
  getLinearLayoutSpacing,
  getLinearLayoutTickOffsets,
} from "Features/annotations/utils/getLinearLayoutBars";
import coerceAnnotationNumericFields from "Features/annotations/utils/coerceAnnotationNumericFields";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import NodeSegmentLengthsStatic from "./NodeSegmentLengthsStatic";

// LINEAR_LAYOUT (calepinage linéaire) renderer.
//
// The 2 stored points are the BOTTOM edge of the band; the band of `width`
// meters extends perpendicular on one side (stripOrientation flips the side).
// Representation: pale band rectangle, central axis with arrowheads, short
// screen-sized ticks at each bar position (real-world spacing), ONE sample bar
// at real scale (full band width, strokeWidth cm thick), and a two-line label
// centered in the band. Bar positions come from getLinearLayoutBars so the
// render can never diverge from the computed quantities.

const TICK_HALF_SCREEN_PX = 7;
const ARROW_SCREEN_PX = 10;

function NodeLinearLayoutStatic({
  annotation,
  annotationOverride,
  selected,
  baseMapMeterByPx,
  containerK,
  isTransient,
  selectedPointId,
  selectedPointIds = [],
  selectedPartId,
  printMode,
  disableVertexEditing = false,
}) {
  if (annotation.id.startsWith("temp")) selected = true;

  const [hoveredPartId, setHoveredPartId] = useState(null);
  const mergedAnnotation = coerceAnnotationNumericFields({
    ...annotation,
    ...annotationOverride,
  });

  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );

  // props

  let {
    id: annotationId,
    points = [],
    strokeColor = theme.palette.secondary.main,
    strokeOpacity = 1,
    strokeWidth = 15,
    strokeWidthUnit = "CM",
    fillOpacity = 0.15,
    width,
    densityMode = "SPACING",
    densityValue,
    densityUnitLabel,
    stripOrientation = 1,
    layoutAlign = "CENTER",
    axisPosition = "MIDDLE",
    textAlign = "CENTER",
    hideBandFill = false,
  } = mergedAnnotation || {};

  if (!strokeColor) strokeColor = theme.palette.secondary.main;

  const commonDataProps = {
    "data-node-id": annotationId,
    "data-node-entity-id": mergedAnnotation.entityId,
    "data-node-listing-id": mergedAnnotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "LINEAR_LAYOUT",
  };

  // geometry

  const p1 = points[0];
  const p2 = points[1];
  const hasSegment =
    p1 &&
    p2 &&
    Number.isFinite(p1.x) &&
    Number.isFinite(p1.y) &&
    Number.isFinite(p2.x) &&
    Number.isFinite(p2.y);

  const dx = hasSegment ? p2.x - p1.x : 0;
  const dy = hasSegment ? p2.y - p1.y : 0;
  const lengthPx = Math.hypot(dx, dy);
  const rawAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const hasScale = baseMapMeterByPx > 0;
  const widthM = parseFloat(width);
  const widthPx =
    hasScale && Number.isFinite(widthM) && widthM > 0
      ? widthM / baseMapMeterByPx
      : 0;

  // Band on one side of the segment: -y in the local frame (above the drawn
  // edge when drawing left → right); stripOrientation -1 flips the side.
  const yBand = -stripOrientation * widthPx;
  const bandY = Math.min(0, yBand);
  const bandH = Math.abs(yBand);
  // Ruler (axis + ticks) position across the band: MIDDLE, or at 25% from the
  // bottom (drawn) edge / from the top edge.
  const axisFraction =
    axisPosition === "BOTTOM" ? 0.25 : axisPosition === "TOP" ? 0.75 : 0.5;
  const yMid = yBand * axisFraction;

  const spacingM = getLinearLayoutSpacing(mergedAnnotation);
  const tickOffsets = useMemo(() => {
    if (!hasScale || !(spacingM > 0)) return [];
    return getLinearLayoutTickOffsets({
      length: lengthPx,
      spacing: spacingM / baseMapMeterByPx,
      align: layoutAlign,
    });
  }, [hasScale, spacingM, lengthPx, baseMapMeterByPx, layoutAlign]);

  // Sample bar at real scale (full band width, strokeWidth cm thick).
  const barThicknessPx = hasScale
    ? strokeWidthUnit === "CM"
      ? (strokeWidth * 0.01) / baseMapMeterByPx
      : strokeWidth
    : 0;

  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // label — upright text (NodeCoteStatic pattern)

  let labelAngleDeg = rawAngleDeg;
  let textFlip = false;
  if (labelAngleDeg > 90) {
    labelAngleDeg -= 180;
    textFlip = true;
  } else if (labelAngleDeg < -90) {
    labelAngleDeg += 180;
    textFlip = true;
  }
  // Side of the band interior in the normalized (upright) label frame.
  const interiorSign = (yBand < 0 ? -1 : 1) * (textFlip ? -1 : 1);

  // Text position along the ruler: anchor at the start / middle / end of the
  // axis, in world coordinates (yMid along the unit normal of the local frame).
  const textFraction =
    textAlign === "LEFT" ? 0 : textAlign === "RIGHT" ? 1 : 0.5;
  const labelAnchor = useMemo(() => {
    if (!hasSegment) return null;
    const ux = lengthPx > 0 ? dx / lengthPx : 1;
    const uy = lengthPx > 0 ? dy / lengthPx : 0;
    return {
      x: p1.x + dx * textFraction - uy * yMid,
      y: p1.y + dy * textFraction + ux * yMid,
    };
  }, [hasSegment, p1, dx, dy, lengthPx, yMid, textFraction]);

  // SVG anchor + padding in the upright label frame. With textFlip the frame's
  // +x runs opposite to the segment direction, so start/end and the padding
  // sign swap to keep the text INSIDE the band, clear of the arrowheads.
  const textFrameSign = textFlip ? -1 : 1;
  let svgTextAnchor = "middle";
  let textPadX = 0;
  if (textAlign === "LEFT") {
    svgTextAnchor = textFlip ? "end" : "start";
    textPadX = textFrameSign * 16;
  } else if (textAlign === "RIGHT") {
    svgTextAnchor = textFlip ? "start" : "end";
    textPadX = -textFrameSign * 16;
  }

  // The annotation's OWN label (never the linked entity's) — same rule as the
  // label chip (getAnnotationOwnLabel), resolved rows carry it as
  // annotationLabel.
  const label = getAnnotationOwnLabel(mergedAnnotation);
  const labelLine1 = `${label ?? ""}${
    Number.isFinite(widthM) ? `${label ? " - " : ""}L = ${widthM}m` : ""
  }`;
  const densityValueNum = parseFloat(densityValue);
  const labelLine2 = Number.isFinite(densityValueNum)
    ? densityMode === "PER_METER"
      ? `${densityValueNum} ${densityUnitLabel ?? ""}`.trim()
      : `esp. ${densityValueNum} cm`
    : "";
  // The two-line text is intrinsic to the representation (like COTE values):
  // it stays visible even when the annotation is not selected and ignores the
  // global labels toggle (forceHideLabel).
  const showLabel = Boolean(labelLine1 || labelLine2);

  // render vertices (NodeStripStatic pattern)

  const vertexSizeMultiplier =
    useSelector((s) => s.mapEditor.vertexSizeMultiplier) || 1;
  const POINT_SIZE = 6 * vertexSizeMultiplier;
  const HALF_SIZE = POINT_SIZE / 2;

  const renderVertex = (pt) => {
    const isPointSelected =
      selectedPointId === pt.id || selectedPointIds.includes(pt.id);
    return (
      <g
        key={pt.id}
        transform={`translate(${pt.x}, ${pt.y})`}
        style={{
          cursor: isTransient ? "crosshair" : "pointer",
          pointerEvents: "all",
        }}
        data-node-type="VERTEX"
        data-point-id={pt.id}
        data-annotation-id={annotationId}
      >
        <g style={{ transform: counterScaleTransform }}>
          <rect
            x={-HALF_SIZE}
            y={-HALF_SIZE}
            width={POINT_SIZE}
            height={POINT_SIZE}
            fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
            stroke="#2196f3"
            strokeWidth={1.5}
          />
        </g>
      </g>
    );
  };

  if (!hasSegment || lengthPx <= 0) return null;

  const mainPartId = `${annotationId}::MAIN`;
  const segPartId = `${annotationId}::SEG::0`;
  const isMainHovered = hoveredPartId === mainPartId;
  const bandFill =
    isMainHovered && !isTransient ? darken(strokeColor, 0.2) : strokeColor;
  // hideBandFill: the rectangle stays as an invisible hit surface (selection
  // still needs a clickable area) — only its paint goes away.
  const bandFillOpacity = hideBandFill ? 0 : fillOpacity;

  const showBand = hasScale && widthPx > 0;

  const guideStroke =
    selected && selectedPartId === segPartId
      ? theme.palette.annotation?.selectedPart || "#ff0000"
      : hoveredPartId === segPartId && selected
        ? darken(strokeColor, 0.2)
        : strokeColor;

  return (
    <g {...commonDataProps}>
      {/* band + axis + ticks + sample bar, in the local segment frame */}
      {showBand && (
        <g transform={`translate(${p1.x}, ${p1.y}) rotate(${rawAngleDeg})`}>
          {/* band rectangle — main hit surface */}
          <rect
            x={0}
            y={bandY}
            width={lengthPx}
            height={bandH}
            fill={bandFill}
            fillOpacity={bandFillOpacity}
            data-part-id={selected ? mainPartId : undefined}
            data-part-type="MAIN"
            data-node-id={annotationId}
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHoveredPartId(mainPartId);
            }}
            onMouseLeave={() => setHoveredPartId(null)}
            style={{
              cursor: isTransient ? "crosshair" : "pointer",
              pointerEvents: "all",
              transition: "fill 0.2s",
            }}
          />

          {/* sample bar at real scale, placed so ~1/5 of the ticks stay on
              its left (matches the reference drawing) */}
          {tickOffsets.length > 0 && barThicknessPx > 0 && (
            <rect
              x={
                tickOffsets[
                  Math.min(
                    Math.floor(tickOffsets.length / 5),
                    tickOffsets.length - 1
                  )
                ] -
                barThicknessPx / 2
              }
              y={bandY}
              width={Math.max(barThicknessPx, 0.1)}
              height={bandH}
              fill={strokeColor}
              fillOpacity={0.9}
              style={{ pointerEvents: "none" }}
            />
          )}

          {/* central axis */}
          <line
            x1={0}
            y1={yMid}
            x2={lengthPx}
            y2={yMid}
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeOpacity={strokeOpacity}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />

          {/* axis arrowheads (constant screen size) */}
          {[0, 1].map((end) => (
            <g
              key={`arrow-${end}`}
              transform={`translate(${end === 0 ? 0 : lengthPx}, ${yMid})${
                end === 0 ? " rotate(180)" : ""
              }`}
              style={{ pointerEvents: "none" }}
            >
              <g style={{ transform: counterScaleTransform }}>
                <path
                  d={`M 0 0 L ${-ARROW_SCREEN_PX} ${-ARROW_SCREEN_PX * 0.4} L ${-ARROW_SCREEN_PX} ${ARROW_SCREEN_PX * 0.4} Z`}
                  fill={strokeColor}
                  fillOpacity={strokeOpacity}
                />
              </g>
            </g>
          ))}

          {/* bar ticks (real-world positions, constant screen length) */}
          {tickOffsets.map((t, i) => (
            <g
              key={`tick-${i}`}
              transform={`translate(${t}, ${yMid})`}
              style={{ pointerEvents: "none" }}
            >
              <g style={{ transform: counterScaleTransform }}>
                <line
                  x1={0}
                  y1={-TICK_HALF_SCREEN_PX}
                  x2={0}
                  y2={TICK_HALF_SCREEN_PX}
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  strokeOpacity={strokeOpacity}
                />
              </g>
            </g>
          ))}
        </g>
      )}

      {/* guide line — bottom edge of the band (the drawn segment) */}
      <g
        onMouseEnter={
          selected
            ? (e) => {
                e.stopPropagation();
                setHoveredPartId(segPartId);
              }
            : undefined
        }
        onMouseLeave={selected ? () => setHoveredPartId(null) : undefined}
        data-part-id={selected ? segPartId : undefined}
        data-part-type={selected ? "SEG" : undefined}
        data-node-id={annotationId}
        style={{
          cursor: isTransient
            ? "crosshair"
            : interactionMode === "EDIT"
              ? "move"
              : "pointer",
        }}
      >
        {selected && (
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="rgba(0,0,0,0)"
            strokeWidth={22}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "stroke" }}
          />
        )}
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={guideStroke}
          strokeWidth={selected ? 2.5 : 1.5}
          strokeOpacity={strokeOpacity}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: selected ? undefined : "none" }}
        />
      </g>

      {/* two-line label centered on the axis, constant screen size */}
      {showBand && showLabel && labelAnchor && (
        <g
          transform={`translate(${labelAnchor.x}, ${labelAnchor.y}) rotate(${labelAngleDeg})`}
          style={{ pointerEvents: "none" }}
        >
          <g style={{ transform: counterScaleTransform }}>
            {labelLine1 && (
              <text
                x={textPadX}
                y={interiorSign < 0 ? -26 : 22}
                textAnchor={svgTextAnchor}
                fontSize={13}
                fontWeight="bold"
                fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                fill={printMode ? "#000000" : darken(strokeColor, 0.4)}
                style={{
                  userSelect: "none",
                  paintOrder: "stroke",
                  stroke: "white",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
              >
                {labelLine1}
              </text>
            )}
            {labelLine2 && (
              <text
                x={textPadX}
                y={interiorSign < 0 ? -12 : 36}
                textAnchor={svgTextAnchor}
                fontSize={12}
                fontStyle="italic"
                fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                fill={printMode ? "#000000" : darken(strokeColor, 0.4)}
                style={{
                  userSelect: "none",
                  paintOrder: "stroke",
                  stroke: "white",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
              >
                {labelLine2}
              </text>
            )}
          </g>
        </g>
      )}

      {/* vertices */}
      {selected &&
        !disableVertexEditing &&
        points.map((pt) => renderVertex(pt))}

      {/* editable segment-length cote on the guide segment, EDIT
          (Modification) mode only — same component as POLYLINE / STRIP */}
      {selected && !disableVertexEditing && (
        <NodeSegmentLengthsStatic
          annotation={mergedAnnotation}
          points={points}
          closed={false}
          selected={selected}
          selectedPointId={selectedPointId}
          baseMapMeterByPx={baseMapMeterByPx}
          containerK={containerK}
          printMode={printMode}
          isTransient={isTransient}
          disableVertexEditing={disableVertexEditing}
        />
      )}
    </g>
  );
}

export default memo(NodeLinearLayoutStatic);
