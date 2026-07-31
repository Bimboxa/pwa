import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { IconButton } from "@mui/material";
import { darken } from "@mui/material/styles";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import getRulerSegments from "Features/annotations/utils/getRulerSegments";
import getRulerLabelPlacement, {
  getRulerFieldPlacement,
} from "Features/annotations/utils/getRulerLabelPlacement";
import offsetPolylineParallel from "Features/geometry/utils/offsetPolylineParallel";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import applyRulerSegmentLengthService from "Features/annotations/services/applyRulerSegmentLengthService";

// Screen-px gap pushing the (optional) total value beyond the segment values.
const TOTAL_LINE_GAP_PX = 28;

// Half-length of the graduation ticks drawn ON the polyline, in screen px.
// Chain extremities get the long tick, interior joints the short one — those
// ticks are what separates one segment from the next.
const TICK_HALF_END_PX = 9;
const TICK_HALF_INNER_PX = 5;

const VERTEX_HALF_SIZE_PX = 4;

// Inline length editor footprint, screen px. A <foreignObject> hit-tests only
// within its own box, so it must comfortably contain input + padlock.
const FIELD_W_PX = 116;
const FIELD_H_PX = 30;

// The alignment guide and the selection affordances share one blue.
const GUIDE_COLOR = "#2196f3";

// Screen-px padding of the invisible pointer band around the drawn line, so
// hover / click do not require landing exactly on a 1px stroke.
const HIT_STROKE_PADDING_SCREEN_PX = 20;

// A RULER is a dimension CHAIN. On the page it is a SINGLE line — the drawn
// polyline, with small orthogonal ticks separating its segments — plus one
// value per segment.
//
// The values are laid out against an "alignment line": the true PARALLEL offset
// of the polyline (see offsetPolylineParallel), so each of its segments stays
// parallel to its source segment and the joints miter. That line is a GUIDE,
// not part of the
// drawing: it only appears while the ruler is selected, in blue, and is the
// handle that moves the values. Values themselves stay HORIZONTAL whatever the
// segment direction, anchored against the guide — a vertical ruler therefore
// reads as a clean right- (or left-) aligned column.
//
// Two interactions live here (like NodeCoteStatic, this node owns its own
// pointer handling rather than routing through InteractionLayer):
//   - dragging the alignment line (or a value) changes `extensionOffset` —
//     signed, so the drag also chooses which side the values sit on;
//   - selecting a vertex opens a number field on each adjacent segment, with a
//     padlock deciding whether the OTHER segment absorbs the change or the
//     rest of the chain is translated.
//
// Vertex selection / drag itself is NOT handled here: the
// `data-node-type="VERTEX"` markup below is what InteractionLayer + usePointDrag
// hit-test, exactly as in NodePolylineStatic.
export default function NodeRulerStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  selectedPointId,
  baseMapMeterByPx,
  baseMapImageScale = 1,
  containerK = 1,
  printMode,
  isTransient,
  disableVertexEditing = false,
}) {
  // data

  const merged = { ...annotation, ...annotationOverride };

  const {
    id: annotationId,
    points = [],
    strokeColor = "#000000",
    strokeWidth = 1,
    strokeWidthUnit = "PX",
    strokeOpacity: rawStrokeOpacity = 1,
    unit = "CM",
    extensionOffset = 8,
    extensionOffsetUnit = "PX",
    decimals = 0,
    fontSize = 18,
    showUnitLabel = true,
    showTotalCote = false,
  } = merged ?? {};

  const dispatch = useDispatch();
  const updateAnnotation = useUpdateAnnotation();

  // state

  const rootGRef = useRef(null);
  const dragRef = useRef(null);
  const [dragOffsetPx, setDragOffsetPx] = useState(null);

  // Padlocks, keyed by segment index. UI-only: they say how the NEXT edit
  // should propagate, not a property of the annotation.
  const [lockedSegments, setLockedSegments] = useState({});
  const [editValues, setEditValues] = useState({});

  // helpers

  const hasScale = Number.isFinite(baseMapMeterByPx) && baseMapMeterByPx > 0;
  const isEditable = !printMode && !isTransient;

  const dataProps = {
    "data-node-id": annotationId,
    "data-node-entity-id": merged.entityId,
    "data-node-listing-id": merged.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "RULER",
  };

  const displayStrokeColor = useMemo(() => {
    if (!hovered) return strokeColor;
    try {
      return darken(strokeColor, 0.2);
    } catch {
      return strokeColor;
    }
  }, [strokeColor, hovered]);

  const strokeOpacity = selected ? 1 : rawStrokeOpacity;

  const computedStrokeWidth = useMemo(() => {
    if (strokeWidthUnit === "CM" && hasScale) {
      return (strokeWidth * 0.01) / baseMapMeterByPx;
    }
    return strokeWidth * (baseMapImageScale || 1);
  }, [
    strokeWidth,
    strokeWidthUnit,
    baseMapMeterByPx,
    baseMapImageScale,
    hasScale,
  ]);

  // Hit-area stroke width for pointer detection — always resolved in SCREEN
  // pixels so the trigger distance is zoom-independent (same model as
  // NodePolylineStatic). A CM stroke grows with zoom, so the band is the
  // visible width plus the padding; a PX stroke is already fixed on screen via
  // vectorEffect, so the padding alone is enough.
  const scalesWithZoom = strokeWidthUnit === "CM" && hasScale;
  const hitStrokeWidthCss = useMemo(() => {
    if (scalesWithZoom) {
      const k = containerK || 1;
      return `calc((${computedStrokeWidth} * var(--map-zoom, 1) * ${k} + ${HIT_STROKE_PADDING_SCREEN_PX}) * 1px)`;
    }
    return `${HIT_STROKE_PADDING_SCREEN_PX}px`;
  }, [computedStrokeWidth, scalesWithZoom, containerK]);

  // Signed offset in image-pixel space: where the alignment line sits relative
  // to the drawn polyline.
  const baseOffsetPx = useMemo(() => {
    if (extensionOffsetUnit === "CM" && hasScale) {
      return (extensionOffset * 0.01) / baseMapMeterByPx;
    }
    return extensionOffset;
  }, [extensionOffset, extensionOffsetUnit, baseMapMeterByPx, hasScale]);

  const effectiveOffsetPx = dragOffsetPx !== null ? dragOffsetPx : baseOffsetPx;

  // Counter-scale so text / ticks / fields keep a constant on-page size. In MAP
  // mode `--map-zoom` is the live camera zoom; in PORTFOLIO it falls back to 1
  // and containerK is the print scale — one expression handles both.
  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const { segments, offsetPoints, totalText } = useMemo(
    () =>
      getRulerSegments({
        points,
        meterByPx: baseMapMeterByPx,
        unit,
        decimals,
        showUnitLabel,
        offsetPx: effectiveOffsetPx,
      }),
    [
      points,
      baseMapMeterByPx,
      unit,
      decimals,
      showUnitLabel,
      effectiveOffsetPx,
    ]
  );

  // Optional total line: pushed further out on the same side. `|| 1` keeps it
  // outside even when the segment line sits exactly on the polyline. Only the
  // offset chain is needed — the value is the already-computed totalText.
  const totalOffsetPx =
    effectiveOffsetPx + Math.sign(effectiveOffsetPx || 1) * TOTAL_LINE_GAP_PX;
  const totalPoints = useMemo(() => {
    if (!showTotalCote) return null;
    return offsetPolylineParallel(points, totalOffsetPx);
  }, [showTotalCote, points, totalOffsetPx]);

  // Which segments the selected vertex touches: [before, after], either can be
  // null at a chain extremity.
  const selectedPointIndex = useMemo(() => {
    if (!selectedPointId) return -1;
    return points.findIndex((p) => p?.id === selectedPointId);
  }, [points, selectedPointId]);

  const editableSegmentIndexes = useMemo(() => {
    if (selectedPointIndex < 0) return [];
    const list = [];
    if (selectedPointIndex - 1 >= 0) list.push(selectedPointIndex - 1);
    if (selectedPointIndex <= points.length - 2) list.push(selectedPointIndex);
    return list;
  }, [selectedPointIndex, points.length]);

  // Reset the padlocks and any half-typed value when the selection moves.
  useEffect(() => {
    setLockedSegments({});
    setEditValues({});
  }, [selectedPointId, annotationId]);

  // handlers — alignment line drag (perpendicular slide → extensionOffset)

  const handleOffsetPointerDown = useCallback(
    (e, segmentIndex) => {
      if (!isEditable) return;
      if (e.button !== undefined && e.button !== 0) return;
      const root = rootGRef.current;
      const svg = root?.ownerSVGElement;
      const ctm = root?.getScreenCTM();
      if (!root || !svg || !ctm) return;

      const seg = segments[segmentIndex];
      if (!seg) return;
      const dx = seg.P2.x - seg.P1.x;
      const dy = seg.P2.y - seg.P1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const imgPt = pt.matrixTransform(ctm.inverse());

      dragRef.current = {
        initialImgPt: { x: imgPt.x, y: imgPt.y },
        initialOffsetPx: baseOffsetPx,
        // Right-of-tangent normal, matching offsetPointsAlongNormals so a
        // positive drag grows the offset in the same direction the chain moves.
        nx: dy / len,
        ny: -dx / len,
      };
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      e.stopPropagation();
      e.preventDefault?.();
    },
    [isEditable, segments, baseOffsetPx]
  );

  const handleOffsetPointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const root = rootGRef.current;
    const svg = root?.ownerSVGElement;
    const ctm = root?.getScreenCTM();
    if (!root || !svg || !ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const imgPt = pt.matrixTransform(ctm.inverse());

    const ddx = imgPt.x - drag.initialImgPt.x;
    const ddy = imgPt.y - drag.initialImgPt.y;
    setDragOffsetPx(drag.initialOffsetPx + ddx * drag.nx + ddy * drag.ny);
    e.stopPropagation();
  }, []);

  const handleOffsetPointerUp = useCallback(
    async (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      // Pointer went down but never moved: a plain click, not a drag. Writing
      // the unchanged offset back would be a pointless DB round-trip.
      if (dragOffsetPx === null) {
        e.stopPropagation();
        return;
      }
      const nextOffset =
        extensionOffsetUnit === "CM" && hasScale
          ? dragOffsetPx * baseMapMeterByPx * 100
          : dragOffsetPx;
      try {
        await updateAnnotation({
          id: annotationId,
          extensionOffset: Math.round(nextOffset * 100) / 100,
        });
      } finally {
        setDragOffsetPx(null);
      }
      e.stopPropagation();
    },
    [
      annotationId,
      dragOffsetPx,
      extensionOffsetUnit,
      hasScale,
      baseMapMeterByPx,
      updateAnnotation,
    ]
  );

  // handlers — inline segment length edit

  const commitSegmentLength = useCallback(
    async (segmentIndex) => {
      const raw = editValues[segmentIndex];
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[segmentIndex];
        return next;
      });
      if (raw === undefined || raw === "") return;

      const typed = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(typed) || typed <= 0) return;

      // The field reads in the display unit; the service works in meters.
      const factor = unit === "M" ? 1 : unit === "MM" ? 0.001 : 0.01;

      // The OTHER adjacent segment is the one whose padlock decides between
      // "absorb" and "translate the rest of the chain".
      const otherSegmentIndex = editableSegmentIndexes.find(
        (i) => i !== segmentIndex
      );
      const lockNeighbour =
        otherSegmentIndex !== undefined &&
        Boolean(lockedSegments[otherSegmentIndex]);

      await applyRulerSegmentLengthService({
        annotation: merged,
        segmentIndex,
        movedPointIndex: selectedPointIndex,
        targetMeters: typed * factor,
        meterByPx: baseMapMeterByPx,
        lockNeighbour,
        dispatch,
      });
    },
    [
      editValues,
      unit,
      editableSegmentIndexes,
      lockedSegments,
      merged,
      selectedPointIndex,
      baseMapMeterByPx,
      dispatch,
    ]
  );

  const handleFieldKeyDown = useCallback((e, segmentIndex) => {
    // Map hotkeys must not fire while typing a length.
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[segmentIndex];
        return next;
      });
      e.currentTarget.blur();
    }
  }, []);

  // render

  if (!points || points.length < 2) return null;
  if (!segments.length) return null;

  const polylineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const nonScaling =
    strokeWidthUnit === "PX" ? "non-scaling-stroke" : undefined;
  const grabCursor = isEditable ? "grab" : "default";
  const canDragValues = Boolean(selected) && isEditable;

  // Tick direction at a vertex: the direction of the alignment line's own
  // joint, i.e. P → Q. The tick then reads as a miniature extension line, and
  // at a corner it follows the miter rather than cutting across it. Falls back
  // to the segment normal when the offset is zero (Q === P).
  const tickDirAt = (i) => {
    const q = offsetPoints[i];
    const dx = q.x - points[i].x;
    const dy = q.y - points[i].y;
    const l = Math.hypot(dx, dy);
    if (l > 1e-6) return { x: dx / l, y: dy / l };
    const prev = i > 0 ? points[i - 1] : points[i];
    const next = i < points.length - 1 ? points[i + 1] : points[i];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    return { x: ty / tl, y: -tx / tl };
  };

  return (
    <g {...dataProps} ref={rootGRef}>
      {/* Invisible pointer band along the line — a ruler stroke is 1px, so
          without it selecting one means landing exactly on the trait. Width is
          resolved in screen px, hence zoom-invariant. */}
      <path
        d={polylineD}
        fill="none"
        stroke="transparent"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{
          strokeWidth: hitStrokeWidthCss,
          cursor: "pointer",
          pointerEvents: "stroke",
        }}
      />

      {/* The ONE line that stays visible: the drawn polyline. */}
      <path
        d={polylineD}
        fill="none"
        stroke={displayStrokeColor}
        strokeWidth={computedStrokeWidth}
        strokeOpacity={strokeOpacity}
        strokeLinejoin="round"
        vectorEffect={nonScaling}
        pointerEvents="none"
      />

      {/* Graduation ticks ON the drawn line — they are what separates one
          segment from the next. Constant screen size, pointing towards the
          alignment line; chain extremities get the long tick. */}
      {points.map((p, i) => {
        const half =
          i === 0 || i === points.length - 1
            ? TICK_HALF_END_PX
            : TICK_HALF_INNER_PX;
        const dir = tickDirAt(i);
        return (
          <g key={`tick-${p.id ?? i}`} transform={`translate(${p.x}, ${p.y})`}>
            <g style={{ transform: counterScaleTransform }}>
              <line
                x1={-dir.x * half}
                y1={-dir.y * half}
                x2={dir.x * half}
                y2={dir.y * half}
                stroke={displayStrokeColor}
                strokeOpacity={strokeOpacity}
                strokeWidth={1.5}
                pointerEvents="none"
              />
            </g>
          </g>
        );
      })}

      {/* Alignment line — a placement guide, not part of the drawing: it only
          shows while the ruler is selected, and it is the drag handle that
          moves the values (extensionOffset, signed → also picks the side). */}
      {selected && (
        <>
          <path
            d={offsetPoints
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ")}
            fill="none"
            stroke={GUIDE_COLOR}
            strokeWidth={1}
            strokeOpacity={0.9}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {isEditable &&
            segments.map((seg) => (
              <line
                key={`grab-${seg.startPointId ?? seg.index}`}
                x1={seg.D1.x}
                y1={seg.D1.y}
                x2={seg.D2.x}
                y2={seg.D2.y}
                stroke="transparent"
                strokeWidth={16}
                onPointerDown={(e) => handleOffsetPointerDown(e, seg.index)}
                onPointerMove={handleOffsetPointerMove}
                onPointerUp={handleOffsetPointerUp}
                onPointerCancel={handleOffsetPointerUp}
                style={{
                  cursor: grabCursor,
                  pointerEvents: "stroke",
                  vectorEffect: "non-scaling-stroke",
                  touchAction: "none",
                }}
              />
            ))}
        </>
      )}

      {/* per-segment values — horizontal, aligned against the alignment line */}
      {segments.map((seg) => {
        const place = getRulerLabelPlacement(seg);
        const isEditing = editableSegmentIndexes.includes(seg.index);
        const field = getRulerFieldPlacement(place, FIELD_W_PX, FIELD_H_PX);

        return (
          <g
            key={`label-${seg.startPointId ?? seg.index}`}
            transform={`translate(${seg.mid.x}, ${seg.mid.y})`}
          >
            <g style={{ transform: counterScaleTransform }}>
              {isEditing && isEditable ? (
                <foreignObject
                  x={field.x}
                  y={field.y}
                  width={FIELD_W_PX}
                  height={FIELD_H_PX}
                  style={{ overflow: "visible" }}
                >
                  {/* The editor must not read as a click on the annotation:
                      InteractionLayer's capture-phase mousedown skips anything
                      inside a `ui-overlay`, and the bubbling mouseup / click
                      are stopped here — otherwise the mouseup would run
                      handleWorldClick and drop the point selection, closing the
                      editor as soon as it is touched. */}
                  <div
                    data-interaction="ui-overlay"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={editValues[seg.index] ?? stripUnit(seg.text)}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [seg.index]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => handleFieldKeyDown(e, seg.index)}
                      onBlur={() => commitSegmentLength(seg.index)}
                      style={{
                        width: 68,
                        height: 24,
                        padding: "0 4px",
                        textAlign: "center",
                        fontSize: 13,
                        fontFamily:
                          '"Roboto", "Helvetica", "Arial", sans-serif',
                        border: `1px solid ${GUIDE_COLOR}`,
                        borderRadius: 4,
                        background: "#fff",
                        color: "#000",
                      }}
                    />
                    {/* Same lock affordance as the template property panel
                        (OverrideToggle): closed = this cote is preserved and
                        the rest of the chain translates instead. */}
                    <IconButton
                      size="small"
                      title={
                        lockedSegments[seg.index]
                          ? "Cote verrouillée : l'édition de l'autre cote translatera la suite"
                          : "Cote libre : elle absorbera l'édition de l'autre cote"
                      }
                      // Keep the focus in the field: letting the button take it
                      // would blur the input and commit the length with the
                      // PREVIOUS lock state — i.e. the opposite of what the
                      // user just asked for.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={() =>
                        setLockedSegments((prev) => ({
                          ...prev,
                          [seg.index]: !prev[seg.index],
                        }))
                      }
                      sx={{
                        p: 0.25,
                        color: lockedSegments[seg.index]
                          ? "action.active"
                          : "text.disabled",
                      }}
                    >
                      {lockedSegments[seg.index] ? (
                        <LockIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <LockOpenIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </div>
                </foreignObject>
              ) : (
                <text
                  x={place.x}
                  y={place.y}
                  textAnchor={place.textAnchor}
                  dominantBaseline={place.dominantBaseline}
                  fontSize={fontSize}
                  fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                  fill={displayStrokeColor}
                  data-ruler-label="1"
                  {...(canDragValues
                    ? {
                        onPointerDown: (e) =>
                          handleOffsetPointerDown(e, seg.index),
                        onPointerMove: handleOffsetPointerMove,
                        onPointerUp: handleOffsetPointerUp,
                        onPointerCancel: handleOffsetPointerUp,
                      }
                    : {})}
                  style={{
                    userSelect: "none",
                    cursor: canDragValues ? grabCursor : "pointer",
                    // Only a selected ruler grabs its values: otherwise the
                    // handlers' stopPropagation would swallow the click that
                    // selects the annotation in the first place.
                    pointerEvents: canDragValues ? "auto" : "none",
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                    touchAction: "none",
                  }}
                >
                  {seg.text}
                </text>
              )}
            </g>
          </g>
        );
      })}

      {/* optional total — same horizontal alignment, pushed further out. No
          extra line: the chain must stay a single visible line. */}
      {showTotalCote &&
        totalPoints &&
        (() => {
          const a = totalPoints[0];
          const b = totalPoints[totalPoints.length - 1];
          const pA = points[0];
          const pB = points[points.length - 1];
          const place = getRulerLabelPlacement({
            P1: pA,
            P2: pB,
            D1: a,
            D2: b,
          });
          return (
            <g
              transform={`translate(${(a.x + b.x) / 2}, ${(a.y + b.y) / 2})`}
            >
              <g style={{ transform: counterScaleTransform }}>
                <text
                  x={place.x}
                  y={place.y}
                  textAnchor={place.textAnchor}
                  dominantBaseline={place.dominantBaseline}
                  fontSize={fontSize}
                  fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                  fill={displayStrokeColor}
                  style={{
                    userSelect: "none",
                    pointerEvents: "none",
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {totalText}
                </text>
              </g>
            </g>
          );
        })()}

      {/* vertices — the data attributes below are what InteractionLayer and
          usePointDrag hit-test; without them the ruler is not editable */}
      {selected &&
        !disableVertexEditing &&
        points.map((pt) => (
          <g
            key={`vertex-${pt.id}`}
            transform={`translate(${pt.x}, ${pt.y})`}
            data-node-type="VERTEX"
            data-point-id={pt.id}
            data-annotation-id={annotationId}
            style={{
              cursor: isTransient ? "crosshair" : "pointer",
              pointerEvents: "all",
            }}
          >
            <g style={{ transform: counterScaleTransform }}>
              <rect
                x={-VERTEX_HALF_SIZE_PX}
                y={-VERTEX_HALF_SIZE_PX}
                width={VERTEX_HALF_SIZE_PX * 2}
                height={VERTEX_HALF_SIZE_PX * 2}
                fill={pt.id === selectedPointId ? "#FF0000" : "#FFFFFF"}
                stroke={GUIDE_COLOR}
                strokeWidth={1.5}
              />
            </g>
          </g>
        ))}
    </g>
  );
}

// The displayed value may carry its unit suffix ("3.00 m"); the input edits the
// number alone.
function stripUnit(text) {
  if (typeof text !== "string") return "";
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) ? String(n) : "";
}
