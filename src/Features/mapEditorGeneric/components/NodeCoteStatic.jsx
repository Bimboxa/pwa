import { useCallback, useMemo, useRef, useState } from "react";
import { darken } from "@mui/material/styles";

import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

export default function NodeCoteStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  baseMapMeterByPx,
  containerK = 1,
  printMode,
  isTransient,
}) {
  // data

  const merged = { ...annotation, ...annotationOverride };

  const {
    id: annotationId,
    points = [],
    strokeColor = "#000000",
    strokeWidth = 1,
    strokeWidthUnit = "PX",
    unit = "CM",
    extensionOffset = 8,
    extensionOffsetUnit = "PX",
    decimals = 0,
    fontSize = 18,
    showUnitLabel = false,
  } = merged ?? {};

  const updateAnnotation = useUpdateAnnotation();

  // refs / state

  const rootGRef = useRef(null);
  const dragRef = useRef(null);
  const [dragOffsetPx, setDragOffsetPx] = useState(null);

  // helpers

  const dataProps = {
    "data-node-id": annotationId,
    "data-node-entity-id": merged.entityId,
    "data-node-listing-id": merged.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "COTE",
  };

  const displayStrokeColor = useMemo(() => {
    if (!hovered) return strokeColor;
    try {
      return darken(strokeColor, 0.2);
    } catch {
      return strokeColor;
    }
  }, [strokeColor, hovered]);

  const hasScale = Number.isFinite(baseMapMeterByPx) && baseMapMeterByPx > 0;

  const computedStrokeWidth = useMemo(() => {
    if (strokeWidthUnit === "CM" && hasScale) {
      return (strokeWidth * 0.01) / baseMapMeterByPx;
    }
    return strokeWidth;
  }, [strokeWidth, strokeWidthUnit, baseMapMeterByPx, hasScale]);

  // signed offset in image-pixel space — controls where the dimension line
  // sits relative to the click points (perpendicular distance).
  const baseExtensionOffsetPx = useMemo(() => {
    if (extensionOffsetUnit === "CM" && hasScale) {
      return (extensionOffset * 0.01) / baseMapMeterByPx;
    }
    return extensionOffset;
  }, [extensionOffset, extensionOffsetUnit, baseMapMeterByPx, hasScale]);

  const effectiveOffsetPx =
    dragOffsetPx !== null ? dragOffsetPx : baseExtensionOffsetPx;

  // Counter-scale the text so it renders at a constant on-page size.
  // In MAP mode, `--map-zoom` reflects the live camera zoom; in PORTFOLIO,
  // it falls back to 1 (CSS default) and `containerK` is the print scale —
  // the same expression handles both cases.
  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // ---- label drag handlers (declared before any conditional return) ----

  const handleLabelPointerDown = useCallback(
    (e) => {
      if (printMode || isTransient) return;
      if (e.button !== undefined && e.button !== 0) return;
      const root = rootGRef.current;
      if (!root) return;
      const ctm = root.getScreenCTM();
      if (!ctm) return;
      const inv = ctm.inverse();
      const svg = root.ownerSVGElement;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const imgPt = pt.matrixTransform(inv);

      const _p1 = points[0];
      const _p2 = points[1];
      const _dx = _p2.x - _p1.x;
      const _dy = _p2.y - _p1.y;
      const _len = Math.hypot(_dx, _dy);
      if (_len === 0) return;
      const _nx = -_dy / _len;
      const _ny = _dx / _len;

      dragRef.current = {
        initialImgPt: { x: imgPt.x, y: imgPt.y },
        initialOffsetPx: baseExtensionOffsetPx,
        nx: _nx,
        ny: _ny,
      };
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      e.stopPropagation();
      e.preventDefault?.();
    },
    [points, baseExtensionOffsetPx, printMode, isTransient]
  );

  const handleLabelPointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const root = rootGRef.current;
    if (!root) return;
    const ctm = root.getScreenCTM();
    if (!ctm) return;
    const svg = root.ownerSVGElement;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const imgPt = pt.matrixTransform(ctm.inverse());

    const ddx = imgPt.x - drag.initialImgPt.x;
    const ddy = imgPt.y - drag.initialImgPt.y;
    const deltaPerp = ddx * drag.nx + ddy * drag.ny;
    setDragOffsetPx(drag.initialOffsetPx + deltaPerp);
    e.stopPropagation();
  }, []);

  const handleLabelPointerUp = useCallback(
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
      // persist
      let nextOffset;
      if (extensionOffsetUnit === "CM" && hasScale) {
        nextOffset = newOffsetPx * baseMapMeterByPx * 100;
      } else {
        nextOffset = newOffsetPx;
      }
      // round to 2 decimals to keep storage clean
      const rounded = Math.round(nextOffset * 100) / 100;
      try {
        await updateAnnotation({ id: annotationId, extensionOffset: rounded });
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

  // ---- geometry — points are already resolved to pixel coordinates ----

  if (!points || points.length < 2) return null;
  const p1 = points[0];
  const p2 = points[1];
  if (!p1 || !p2) return null;
  if (p1.x === p2.x && p1.y === p2.y) return null;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  // canonical perpendicular unit vector (90° CW in y-down screen coords)
  const nx = -uy;
  const ny = ux;

  // dimension line is offset from the click points along n by effectiveOffsetPx
  const ox = nx * effectiveOffsetPx;
  const oy = ny * effectiveOffsetPx;
  const D1 = { x: p1.x + ox, y: p1.y + oy };
  const D2 = { x: p2.x + ox, y: p2.y + oy };

  const showExtensions = Math.abs(effectiveOffsetPx) > 0.001;

  // value text — measured between the click points (not the offset line)

  const valueText = getCoteDisplayValue({
    p1,
    p2,
    meterByPx: baseMapMeterByPx,
    unit,
    decimals,
    showUnitLabel,
  });

  // label transform — at midpoint of the dimension line, rotated, upright

  const mid = { x: (D1.x + D2.x) / 2, y: (D1.y + D2.y) / 2 };
  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  let textFlip = false;
  if (angleDeg > 90) {
    angleDeg -= 180;
    textFlip = true;
  } else if (angleDeg < -90) {
    angleDeg += 180;
    textFlip = true;
  }

  // Text offset perpendicular to the dimension line, in screen px.
  // Place the text on the OPPOSITE side of the dimension line from the click
  // points: with offset > 0 the dim line sits along +n, the click points are
  // at −n, so text goes at +n (away from the clicks). The textFlip case
  // (angle > 90°) inverts the local Y axis, so we negate accordingly.
  const TEXT_OFFSET_PX = 4;
  const offsetSign = effectiveOffsetPx >= 0 ? 1 : -1;
  const flipSign = textFlip ? -1 : 1;
  const textNormalSign = flipSign * offsetSign;

  const strokeOpacity = selected ? 1 : (merged.strokeOpacity ?? 1);

  const labelCursor = printMode || isTransient ? "default" : "grab";

  return (
    <g {...dataProps} ref={rootGRef}>
      {/* main dimension line (offset) */}
      <line
        x1={D1.x}
        y1={D1.y}
        x2={D2.x}
        y2={D2.y}
        stroke={displayStrokeColor}
        strokeWidth={computedStrokeWidth}
        strokeOpacity={strokeOpacity}
        vectorEffect={
          strokeWidthUnit === "PX" ? "non-scaling-stroke" : undefined
        }
        pointerEvents="stroke"
        style={{ cursor: "pointer" }}
      />

      {/* dashed extension lines: click point → dimension line endpoint */}
      {showExtensions && (
        <>
          <line
            x1={p1.x}
            y1={p1.y}
            x2={D1.x}
            y2={D1.y}
            stroke={displayStrokeColor}
            strokeWidth={computedStrokeWidth}
            strokeOpacity={strokeOpacity}
            strokeDasharray="3 3"
            vectorEffect={
              strokeWidthUnit === "PX" ? "non-scaling-stroke" : undefined
            }
            pointerEvents="none"
          />
          <line
            x1={p2.x}
            y1={p2.y}
            x2={D2.x}
            y2={D2.y}
            stroke={displayStrokeColor}
            strokeWidth={computedStrokeWidth}
            strokeOpacity={strokeOpacity}
            strokeDasharray="3 3"
            vectorEffect={
              strokeWidthUnit === "PX" ? "non-scaling-stroke" : undefined
            }
            pointerEvents="none"
          />
        </>
      )}

      {/* value label — centred on dimension line midpoint, rotated, fixed
          screen size in MAP mode, draggable to change extensionOffset */}
      <g transform={`translate(${mid.x}, ${mid.y}) rotate(${angleDeg})`}>
        <g
          style={
            counterScaleTransform
              ? { transform: counterScaleTransform }
              : undefined
          }
        >
          <text
            x={0}
            y={textNormalSign * TEXT_OFFSET_PX}
            textAnchor="middle"
            dominantBaseline={textNormalSign < 0 ? "alphabetic" : "hanging"}
            fontSize={fontSize}
            fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
            fill={displayStrokeColor}
            data-cote-label="1"
            onPointerDown={handleLabelPointerDown}
            onPointerMove={handleLabelPointerMove}
            onPointerUp={handleLabelPointerUp}
            onPointerCancel={handleLabelPointerUp}
            style={{
              userSelect: "none",
              cursor: labelCursor,
              pointerEvents: "auto",
              paintOrder: "stroke",
              stroke: "white",
              strokeWidth: 3,
              strokeLinejoin: "round",
              touchAction: "none",
            }}
          >
            {valueText}
          </text>
        </g>
      </g>

      {/* selection / hover hit area along the dimension line */}
      <line
        x1={D1.x}
        y1={D1.y}
        x2={D2.x}
        y2={D2.y}
        stroke="transparent"
        strokeWidth={16}
        style={{
          cursor: "pointer",
          pointerEvents: "stroke",
          vectorEffect: "non-scaling-stroke",
        }}
      />

      {/* selection indicators on the original click points — small ticks
          perpendicular to the cote line so start/end are unambiguous. The
          inner <g> counter-scales so the tick stays a fixed screen size. */}
      {selected && (
        <>
          <g
            transform={`translate(${p1.x}, ${p1.y}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`}
          >
            <g
              style={
                counterScaleTransform
                  ? { transform: counterScaleTransform }
                  : undefined
              }
            >
              <line
                x1={0}
                y1={-6}
                x2={0}
                y2={6}
                stroke="#2196f3"
                strokeWidth={2}
              />
            </g>
          </g>
          <g
            transform={`translate(${p2.x}, ${p2.y}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`}
          >
            <g
              style={
                counterScaleTransform
                  ? { transform: counterScaleTransform }
                  : undefined
              }
            >
              <line
                x1={0}
                y1={-6}
                x2={0}
                y2={6}
                stroke="#2196f3"
                strokeWidth={2}
              />
            </g>
          </g>
        </>
      )}
    </g>
  );
}
