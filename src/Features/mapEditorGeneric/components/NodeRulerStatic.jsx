import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { darken } from "@mui/material/styles";

import getRulerSegments from "Features/annotations/utils/getRulerSegments";
import offsetPointsAlongNormals from "../utils/offsetPointsAlongNormals";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import applyRulerSegmentLengthService from "Features/annotations/services/applyRulerSegmentLengthService";

// Screen-px gap between the segment alignment line and the (optional) total
// line, so the two never overlap — including at extensionOffset = 0.
const TOTAL_LINE_GAP_PX = 28;

// Half-length of the graduation ticks drawn on the alignment line, in screen
// px. Chain extremities get the long tick, interior joints the short one (the
// classic dimension-chain look).
const TICK_HALF_END_PX = 9;
const TICK_HALF_INNER_PX = 5;

const VERTEX_HALF_SIZE_PX = 4;

// A RULER is a dimension CHAIN: the drawn polyline plus one cote per segment,
// all aligned on a single offset "alignment line". The alignment line is the
// MITER offset of the polyline (see offsetPointsAlongNormals), so it stays
// continuous even when the segments are not collinear.
//
// Two interactions live here (like NodeCoteStatic, this node owns its own
// pointer handling rather than routing through InteractionLayer):
//   - dragging the alignment line changes `extensionOffset` — signed, so the
//     drag also chooses which side the cotes sit on;
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
    return offsetPointsAlongNormals(points, totalOffsetPx, false);
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
      const newOffsetPx = dragOffsetPx ?? drag.initialOffsetPx;
      dragRef.current = null;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      const nextOffset =
        extensionOffsetUnit === "CM" && hasScale
          ? newOffsetPx * baseMapMeterByPx * 100
          : newOffsetPx;
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
  const alignmentD = offsetPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const showExtensions = Math.abs(effectiveOffsetPx) > 0.001;
  const nonScaling =
    strokeWidthUnit === "PX" ? "non-scaling-stroke" : undefined;
  const grabCursor = isEditable ? "grab" : "default";

  // Tick direction at a joint: perpendicular to the neighbour-to-neighbour
  // tangent, i.e. the same frame offsetPointsAlongNormals used.
  const tickAngleDegAt = (i) => {
    const prev = i > 0 ? points[i - 1] : points[i];
    const next = i < points.length - 1 ? points[i + 1] : points[i];
    return (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;
  };

  return (
    <g {...dataProps} ref={rootGRef}>
      {/* the measured polyline itself */}
      <path
        d={polylineD}
        fill="none"
        stroke={displayStrokeColor}
        strokeWidth={computedStrokeWidth}
        strokeOpacity={strokeOpacity}
        strokeLinejoin="round"
        vectorEffect={nonScaling}
        pointerEvents="stroke"
        style={{ cursor: "pointer" }}
      />

      {/* dashed extension lines: measured point → alignment line */}
      {showExtensions &&
        points.map((p, i) => (
          <line
            key={`ext-${p.id ?? i}`}
            x1={p.x}
            y1={p.y}
            x2={offsetPoints[i].x}
            y2={offsetPoints[i].y}
            stroke={displayStrokeColor}
            strokeWidth={computedStrokeWidth}
            strokeOpacity={strokeOpacity}
            strokeDasharray="3 3"
            vectorEffect={nonScaling}
            pointerEvents="none"
          />
        ))}

      {/* alignment line */}
      <path
        d={alignmentD}
        fill="none"
        stroke={displayStrokeColor}
        strokeWidth={computedStrokeWidth}
        strokeOpacity={strokeOpacity}
        strokeLinejoin="round"
        vectorEffect={nonScaling}
        pointerEvents="none"
      />

      {/* graduation ticks — constant screen size, perpendicular to the chain */}
      {offsetPoints.map((q, i) => {
        const half =
          i === 0 || i === offsetPoints.length - 1
            ? TICK_HALF_END_PX
            : TICK_HALF_INNER_PX;
        return (
          <g
            key={`tick-${points[i]?.id ?? i}`}
            transform={`translate(${q.x}, ${q.y}) rotate(${tickAngleDegAt(i)})`}
          >
            <g style={{ transform: counterScaleTransform }}>
              <line
                x1={0}
                y1={-half}
                x2={0}
                y2={half}
                stroke={displayStrokeColor}
                strokeOpacity={strokeOpacity}
                strokeWidth={1.5}
                pointerEvents="none"
              />
            </g>
          </g>
        );
      })}

      {/* drag handle: the alignment line, per segment so the drag can use the
          normal of the segment actually grabbed */}
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

      {/* per-segment value labels */}
      {segments.map((seg) => {
        let angleDeg = seg.angleDeg;
        let textFlip = false;
        if (angleDeg > 90) {
          angleDeg -= 180;
          textFlip = true;
        } else if (angleDeg < -90) {
          angleDeg += 180;
          textFlip = true;
        }
        // Place the text on the side AWAY from the measured polyline.
        const textNormalSign =
          (textFlip ? -1 : 1) * (effectiveOffsetPx >= 0 ? 1 : -1);
        const isEditing = editableSegmentIndexes.includes(seg.index);

        return (
          <g
            key={`label-${seg.startPointId ?? seg.index}`}
            transform={`translate(${seg.mid.x}, ${seg.mid.y}) rotate(${angleDeg})`}
          >
            <g style={{ transform: counterScaleTransform }}>
              {isEditing && isEditable ? (
                <foreignObject
                  x={-70}
                  y={textNormalSign < 0 ? -34 : 4}
                  width={140}
                  height={32}
                  style={{ overflow: "visible" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
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
                        border: "1px solid #2196f3",
                        borderRadius: 4,
                        background: "#fff",
                        color: "#000",
                      }}
                    />
                    <button
                      type="button"
                      title={
                        lockedSegments[seg.index]
                          ? "Cote verrouillée : l'édition de l'autre cote translatera la suite"
                          : "Cote libre : elle absorbera l'édition de l'autre cote"
                      }
                      onClick={() =>
                        setLockedSegments((prev) => ({
                          ...prev,
                          [seg.index]: !prev[seg.index],
                        }))
                      }
                      style={{
                        width: 22,
                        height: 24,
                        padding: 0,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: lockedSegments[seg.index]
                          ? "#2196f3"
                          : "#bdbdbd",
                        borderRadius: 4,
                        background: lockedSegments[seg.index]
                          ? "#e3f2fd"
                          : "#fff",
                        color: lockedSegments[seg.index] ? "#1565c0" : "#757575",
                        fontSize: 12,
                        lineHeight: 1,
                      }}
                    >
                      {lockedSegments[seg.index] ? "🔒" : "🔓"}
                    </button>
                  </div>
                </foreignObject>
              ) : (
                <text
                  x={0}
                  y={textNormalSign * 4}
                  textAnchor="middle"
                  dominantBaseline={textNormalSign < 0 ? "alphabetic" : "hanging"}
                  fontSize={fontSize}
                  fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                  fill={displayStrokeColor}
                  data-ruler-label="1"
                  onPointerDown={(e) => handleOffsetPointerDown(e, seg.index)}
                  onPointerMove={handleOffsetPointerMove}
                  onPointerUp={handleOffsetPointerUp}
                  onPointerCancel={handleOffsetPointerUp}
                  style={{
                    userSelect: "none",
                    cursor: grabCursor,
                    pointerEvents: "auto",
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

      {/* optional total: a second alignment line further out */}
      {showTotalCote && totalPoints && (
        <>
          <path
            d={totalPoints
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ")}
            fill="none"
            stroke={displayStrokeColor}
            strokeWidth={computedStrokeWidth}
            strokeOpacity={strokeOpacity}
            strokeLinejoin="round"
            vectorEffect={nonScaling}
            pointerEvents="none"
          />
          {[0, totalPoints.length - 1].map((i) => (
            <g
              key={`total-tick-${i}`}
              transform={`translate(${totalPoints[i].x}, ${totalPoints[i].y}) rotate(${tickAngleDegAt(i)})`}
            >
              <g style={{ transform: counterScaleTransform }}>
                <line
                  x1={0}
                  y1={-TICK_HALF_END_PX}
                  x2={0}
                  y2={TICK_HALF_END_PX}
                  stroke={displayStrokeColor}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              </g>
            </g>
          ))}
          {(() => {
            const a = totalPoints[0];
            const b = totalPoints[totalPoints.length - 1];
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            let angleDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            let textFlip = false;
            if (angleDeg > 90) {
              angleDeg -= 180;
              textFlip = true;
            } else if (angleDeg < -90) {
              angleDeg += 180;
              textFlip = true;
            }
            const textNormalSign =
              (textFlip ? -1 : 1) * (totalOffsetPx >= 0 ? 1 : -1);
            return (
              <g transform={`translate(${mid.x}, ${mid.y}) rotate(${angleDeg})`}>
                <g style={{ transform: counterScaleTransform }}>
                  <text
                    x={0}
                    y={textNormalSign * 4}
                    textAnchor="middle"
                    dominantBaseline={
                      textNormalSign < 0 ? "alphabetic" : "hanging"
                    }
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
        </>
      )}

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
                stroke="#2196f3"
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
