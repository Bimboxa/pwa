import { memo, useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";
import { darken } from "@mui/material/styles";

import NodeSegmentLengthsStatic from "./NodeSegmentLengthsStatic";
import applyOpeningLengthEditService from "Features/annotations/services/applyOpeningLengthEditService";
import coerceAnnotationNumericFields from "Features/annotations/utils/coerceAnnotationNumericFields";
import getDoorSwingGeometry from "Features/annotations/utils/getDoorSwingGeometry";
import { getOpeningType } from "Features/annotations/utils/isOpeningAnnotation";

// Canonical renderer for OPENING annotations (2-point POLYLINE with
// drawingShape "OPENING"): the wall gap plus the plan symbol of the opening
// type.
//
//   - every type paints an opaque WHITE band (real CM thickness = the wall
//     thickness) over the host wall: that is the gap. Hosts drawn as thick
//     POLYLINEs are never carved (carve.mode "NONE"), so this band is what
//     interrupts the wall; on a carved POLYGON host it just overlays the notch.
//   - NONE   : the gap only.
//   - DOOR   : thin threshold frame around the gap + the leaf (perpendicular
//              to the wall, hinged on one jamb, as long as the opening) + the
//              quarter-circle swing arc back to the opposite jamb
//              (getDoorSwingGeometry — doorHinge / doorSide).
//   - WINDOW : thin frame around the gap + a centre line along the wall.
//
// Symbol lines are drawn in strokeColor with a constant on-screen width.
// Accepts the same core props as NodePolylineStatic so it is drop-in usable
// from NodeAnnotationStatic and TransientTopologyLayer.
//
// Selected, the opening shows ONE editable cote (NodeSegmentLengthsStatic in
// `simple` mode, same EDIT / no-mode gating as the polyline cotes): typing a
// value sets the opening `width` and repositions the jambs
// (applyOpeningLengthEditService — glued openings keep their centre on the
// host, free ones keep p1).

const HIT_STROKE_PADDING_SCREEN_PX = 20;
const GAP_COLOR = "#ffffff";
const SYMBOL_STROKE_SCREEN_PX = 1.5;
const FRAME_STROKE_SCREEN_PX = 1;

function NodeOpeningStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  selectedPointId,
  baseMapMeterByPx,
  containerK,
  printMode,
  isTransient,
  disableVertexEditing,
}) {
  const dispatch = useDispatch();

  const mergedAnnotation = useMemo(
    () =>
      coerceAnnotationNumericFields({
        ...(annotation ?? {}),
        ...(annotationOverride ?? {}),
      }),
    [annotation, annotationOverride]
  );

  const {
    id: annotationId,
    points,
    strokeColor = "#000000",
    strokeOpacity = 1,
    strokeWidth = 20,
    strokeWidthUnit = "CM",
    doorHinge = "START",
    doorSide = 1,
  } = mergedAnnotation;
  const openingType = getOpeningType(mergedAnnotation);

  const p1 = points?.[0];
  const p2 = points?.[1];

  const dataProps = {
    "data-node-id": annotationId,
    "data-node-entity-id": mergedAnnotation.entityId,
    "data-node-listing-id": mergedAnnotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": mergedAnnotation.type,
  };

  const hoverColor = useMemo(() => {
    try {
      return darken(strokeColor, 0.2);
    } catch {
      return strokeColor;
    }
  }, [strokeColor]);

  // Band thickness across the wall (CM → image px via the base map scale).
  const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;
  const bandWidth = isCmUnit
    ? (strokeWidth * 0.01) / baseMapMeterByPx
    : strokeWidth;

  const door = useMemo(
    () =>
      openingType === "DOOR" && p1 && p2
        ? getDoorSwingGeometry({ p1, p2, bandWidth, doorHinge, doorSide })
        : null,
    [openingType, p1, p2, bandWidth, doorHinge, doorSide]
  );

  // handlers

  const handleCommitLength = useCallback(
    ({ targetMeters }) =>
      applyOpeningLengthEditService({
        annotation: mergedAnnotation,
        targetMeters,
        meterByPx: baseMapMeterByPx,
        dispatch,
      }),
    [mergedAnnotation, baseMapMeterByPx, dispatch]
  );

  if (!p1 || !p2) return null;
  if (!Number.isFinite(p1.x) || !Number.isFinite(p2.x)) return null;

  const color = hovered || selected ? hoverColor : strokeColor;
  const gapWidth = Math.max(bandWidth, 0.1);
  const angleDeg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  const openingLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);

  return (
    <g data-capture-node={annotationId}>
      {/* Wall gap: opaque white band over the host wall */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={GAP_COLOR}
        strokeWidth={gapWidth}
        strokeLinecap="butt"
        pointerEvents="none"
      />

      {/* Hover tint so a plain gap (NONE) stays discoverable */}
      {hovered && !selected && (
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={color}
          strokeWidth={gapWidth}
          strokeOpacity={0.15}
          strokeLinecap="butt"
          pointerEvents="none"
        />
      )}

      {/* DOOR: leaf + swing arc */}
      {door && (
        <g
          fill="none"
          stroke={color}
          strokeOpacity={strokeOpacity}
          strokeWidth={SYMBOL_STROKE_SCREEN_PX}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          pointerEvents="none"
        >
          <line
            x1={door.leafStart.x}
            y1={door.leafStart.y}
            x2={door.leafEnd.x}
            y2={door.leafEnd.y}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M ${door.leafEnd.x} ${door.leafEnd.y} A ${door.radius} ${door.radius} 0 0 ${door.sweepFlag} ${door.arcEnd.x} ${door.arcEnd.y}`}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}

      {/* Thin frame around the gap: the door threshold (both wall faces +
          jambs) for a DOOR, the window frame (+ centre line) for a WINDOW */}
      {(openingType === "DOOR" || openingType === "WINDOW") && (
        <g
          transform={`translate(${p1.x}, ${p1.y}) rotate(${angleDeg})`}
          fill="none"
          stroke={color}
          strokeOpacity={strokeOpacity}
          strokeWidth={FRAME_STROKE_SCREEN_PX}
          pointerEvents="none"
        >
          <rect
            x={0}
            y={-gapWidth / 2}
            width={openingLength}
            height={gapWidth}
            vectorEffect="non-scaling-stroke"
          />
          {openingType === "WINDOW" && (
            <line
              x1={0}
              y1={0}
              x2={openingLength}
              y2={0}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
      )}

      {/* Selection halo */}
      {selected && (
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}

      {/* Hit area (zoom-independent padding) */}
      {!isTransient && (
        <line
          {...dataProps}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke="transparent"
          strokeWidth={HIT_STROKE_PADDING_SCREEN_PX}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          pointerEvents="stroke"
          // Selected: the whole opening can be dragged along its wall.
          style={{ cursor: selected ? "move" : "pointer" }}
        />
      )}
      {/* Editable length cote (opening width) — mounted AFTER the hit area so
          the transparent stroke does not swallow the clicks on the label */}
      {selected && !isTransient && !printMode && (
        <NodeSegmentLengthsStatic
          simple
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
          onCommitLength={handleCommitLength}
        />
      )}
    </g>
  );
}

export default memo(NodeOpeningStatic);
