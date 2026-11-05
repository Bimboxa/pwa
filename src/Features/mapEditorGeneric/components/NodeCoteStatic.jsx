import { useCallback, useMemo, useRef, useState } from "react";
import { darken } from "@mui/material/styles";

import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import {
  COTE_STYLE_LABEL,
  DEFAULT_COTE_DECIMALS,
  DEFAULT_COTE_STYLE,
  DEFAULT_COTE_UNIT,
} from "Features/annotations/constants/coteDisplayDefaults";
import getCotePageScale from "Features/annotations/utils/getCotePageScale";
import getCoteLabelText from "Features/annotations/utils/getCoteLabelText";
import getCoteLabelStyleGeometry, {
  getCoteLabelOffsetFromAnchor,
} from "Features/annotations/utils/getCoteLabelStyleGeometry";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

// Default page-pt placement of a degenerate (vertical) cote's value label
// relative to its marker, when the user hasn't dragged it yet.
const DEGENERATE_LABEL_DEFAULT_OFFSET = { x: 12, y: -12 };

// Sizes of the cote "ink", in page points of the base map's print zone.
const TEXT_OFFSET_PT = 4;
const TEXT_HALO_PT = 3;
const DASH_PT = 3;

// "Étiquette" style (coteStyle LABEL), page points: how far the bar and the
// extension lines run past each other, the gap between the leader's end and
// the label, and the opacity of the secondary lines (extensions + leader).
const LABEL_STYLE_OVERSHOOT_PT = 4;
const LABEL_STYLE_TEXT_GAP_PT = 3;
const LABEL_STYLE_LINE_OPACITY = 0.45;

// Screen px the pointer must travel before a press on the value label turns
// into a drag — below it the gesture is a click, which selects the cote.
const LABEL_DRAG_THRESHOLD_PX = 3;

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
    unit = DEFAULT_COTE_UNIT,
    extensionOffset = 8,
    extensionOffsetUnit = "PX",
    decimals = DEFAULT_COTE_DECIMALS,
    fontSize = 18,
    showUnitLabel = true,
    coteStyle = DEFAULT_COTE_STYLE,
  } = merged ?? {};

  // "Étiquette" style: horizontal "<label> = <value>" tied to the bar by a
  // leader; the bar (when selected) and the label are both draggable.
  const isLabelStyle = coteStyle === COTE_STYLE_LABEL;

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

  // Hit-test markup of the value label. `draggable` + `data-node-id` is what
  // InteractionLayer reads on mousedown; `data-drag-owner="node"` tells it the
  // drag itself is handled HERE (pointer events below), so it only absorbs
  // the mouse gesture (no pan) and selects the cote on a plain click — a
  // click on the label then selects exactly like a click on the line.
  const labelHitProps =
    printMode || isTransient
      ? {}
      : {
          "data-interaction": "draggable",
          "data-node-id": annotationId,
          "data-drag-owner": "node",
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

  // Page-pt → image-px scale: the cote ink (text, halo, PX strokes, dashes) is
  // sized in points of the print zone, hence FIXED relative to the base map —
  // same rule as FREE_TEXT. Selection affordances stay screen-constant.
  const pageScale = getCotePageScale(merged);
  const pageScaleTransform = `scale(${pageScale})`;

  // A PX stroke width reads as page points.
  const computedStrokeWidth = useMemo(() => {
    if (strokeWidthUnit === "CM" && hasScale) {
      return (strokeWidth * 0.01) / baseMapMeterByPx;
    }
    return strokeWidth * pageScale;
  }, [strokeWidth, strokeWidthUnit, baseMapMeterByPx, hasScale, pageScale]);

  const dashArray = `${DASH_PT * pageScale} ${DASH_PT * pageScale}`;

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

  // Counter-scale of the selection affordances (constant SCREEN size).
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
      // Shift+press belongs to the lasso / multi-selection toggle.
      if (e.shiftKey) return;
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
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      // Pointer-only stop: the compatibility mousedown must still reach
      // InteractionLayer (see labelHitProps). No preventDefault here for the
      // same reason — cancelling pointerdown suppresses the mouse events.
      e.stopPropagation();
    },
    [points, baseExtensionOffsetPx, printMode, isTransient]
  );

  const handleLabelPointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved) {
      const dist = Math.hypot(
        e.clientX - drag.startClient.x,
        e.clientY - drag.startClient.y
      );
      if (dist <= LABEL_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
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
      dragRef.current = null;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      // Plain click (no move past the threshold): nothing to persist — the
      // selection is handled by InteractionLayer on the mouseup.
      if (dragOffsetPx === null) {
        e.stopPropagation();
        return;
      }
      const newOffsetPx = dragOffsetPx;
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

  // ---- degenerate (vertical) cote label drag ----
  // The label of a degenerate cote has no perpendicular direction to slide
  // along; instead it carries a free 2D placement offset in PAGE pt
  // (`annotation.labelOffset`), consistent with the label's page-pt size.
  // The client-px drag delta is converted with the screen scale of the
  // page-scaled group (its CTM), captured at pointer down.

  const storedLabelOffset = merged?.labelOffset;
  const degenerateGRef = useRef(null);
  const degenerateDragRef = useRef(null);
  const [dragLabelOffset, setDragLabelOffset] = useState(null);

  const handleDegenerateLabelPointerDown = useCallback(
    (e) => {
      if (printMode || isTransient) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.shiftKey) return;
      const initial = storedLabelOffset ?? DEGENERATE_LABEL_DEFAULT_OFFSET;
      const ctm = degenerateGRef.current?.getScreenCTM?.();
      const clientPxPerPt = ctm ? Math.hypot(ctm.a, ctm.b) : 0;
      degenerateDragRef.current = {
        startClient: { x: e.clientX, y: e.clientY },
        initialOffset: { x: initial.x, y: initial.y },
        clientPxPerPt: clientPxPerPt > 0 ? clientPxPerPt : 1,
        moved: false,
      };
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      // Same as handleLabelPointerDown: keep the mouse events alive.
      e.stopPropagation();
    },
    [storedLabelOffset, printMode, isTransient]
  );

  const handleDegenerateLabelPointerMove = useCallback((e) => {
    const drag = degenerateDragRef.current;
    if (!drag) return;
    if (!drag.moved) {
      const dist = Math.hypot(
        e.clientX - drag.startClient.x,
        e.clientY - drag.startClient.y
      );
      if (dist <= LABEL_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
    setDragLabelOffset({
      x:
        drag.initialOffset.x +
        (e.clientX - drag.startClient.x) / drag.clientPxPerPt,
      y:
        drag.initialOffset.y +
        (e.clientY - drag.startClient.y) / drag.clientPxPerPt,
    });
    e.stopPropagation();
  }, []);

  const handleDegenerateLabelPointerUp = useCallback(
    async (e) => {
      const drag = degenerateDragRef.current;
      if (!drag) return;
      degenerateDragRef.current = null;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      if (dragLabelOffset === null) {
        // Plain click: InteractionLayer selects the cote on the mouseup.
        e.stopPropagation();
        return;
      }
      const next = dragLabelOffset;
      try {
        await updateAnnotation({
          id: annotationId,
          labelOffset: { x: Math.round(next.x), y: Math.round(next.y) },
        });
      } finally {
        setDragLabelOffset(null);
      }
      e.stopPropagation();
    },
    [annotationId, dragLabelOffset, updateAnnotation]
  );

  // ---- "Étiquette" style label drag ----
  // The label sits at `annotation.coteLabelOffset2d` (page pt, relative to the
  // bar's midpoint, outward-positive — see getCoteLabelStyleGeometry). The
  // drag moves its screen-oriented anchor: along the horizontal only for a
  // vertical-like cote, freely otherwise.

  const storedLabelOffset2d = merged?.coteLabelOffset2d;
  const labelStyleGRef = useRef(null);
  const labelStyleDragRef = useRef(null);
  const [dragLabelOffset2d, setDragLabelOffset2d] = useState(null);

  const handleStyleLabelPointerDown = useCallback(
    (e) => {
      if (printMode || isTransient) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.shiftKey) return;
      const geom = getCoteLabelStyleGeometry({
        p1: points[0],
        p2: points[1],
        offsetPx: baseExtensionOffsetPx,
        labelOffset: storedLabelOffset2d,
      });
      if (!geom) return;
      const ctm = labelStyleGRef.current?.getScreenCTM?.();
      const clientPxPerPt = ctm ? Math.hypot(ctm.a, ctm.b) : 0;
      labelStyleDragRef.current = {
        startClient: { x: e.clientX, y: e.clientY },
        initialAnchorPt: geom.anchorPt,
        isVerticalLike: geom.isVerticalLike,
        outSign: geom.outSign,
        clientPxPerPt: clientPxPerPt > 0 ? clientPxPerPt : 1,
        moved: false,
      };
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      // Same as handleLabelPointerDown: keep the mouse events alive.
      e.stopPropagation();
    },
    [points, baseExtensionOffsetPx, storedLabelOffset2d, printMode, isTransient]
  );

  const handleStyleLabelPointerMove = useCallback((e) => {
    const drag = labelStyleDragRef.current;
    if (!drag) return;
    if (!drag.moved) {
      const dist = Math.hypot(
        e.clientX - drag.startClient.x,
        e.clientY - drag.startClient.y
      );
      if (dist <= LABEL_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
    const ddx = (e.clientX - drag.startClient.x) / drag.clientPxPerPt;
    const ddy = (e.clientY - drag.startClient.y) / drag.clientPxPerPt;
    setDragLabelOffset2d(
      getCoteLabelOffsetFromAnchor({
        anchorPt: {
          x: drag.initialAnchorPt.x + ddx,
          y: drag.isVerticalLike ? 0 : drag.initialAnchorPt.y + ddy,
        },
        isVerticalLike: drag.isVerticalLike,
        outSign: drag.outSign,
      })
    );
    e.stopPropagation();
  }, []);

  const handleStyleLabelPointerUp = useCallback(
    async (e) => {
      const drag = labelStyleDragRef.current;
      if (!drag) return;
      labelStyleDragRef.current = null;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      if (dragLabelOffset2d === null) {
        // Plain click: InteractionLayer selects the cote on the mouseup.
        e.stopPropagation();
        return;
      }
      const next = dragLabelOffset2d;
      try {
        await updateAnnotation({
          id: annotationId,
          coteLabelOffset2d: {
            x: Math.round(next.x * 10) / 10,
            y: Math.round(next.y * 10) / 10,
          },
        });
      } finally {
        setDragLabelOffset2d(null);
      }
      e.stopPropagation();
    },
    [annotationId, dragLabelOffset2d, updateAnnotation]
  );

  // ---- geometry — points are already resolved to pixel coordinates ----

  if (!points || points.length < 2) return null;
  const p1 = points[0];
  const p2 = points[1];
  if (!p1 || !p2) return null;

  // vertical delta between the two endpoints (meters) — non-zero for cotes
  // drawn in 3D; the annotation-level offsetZ cancels out in the difference.
  const deltaZMeters = (p2.offsetBottom ?? 0) - (p1.offsetBottom ?? 0);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);

  const strokeOpacity = selected ? 1 : (merged.strokeOpacity ?? 1);

  const labelCursor = printMode || isTransient ? "default" : "grab";

  // value text — measured between the click points (not the offset line)

  const valueText = getCoteDisplayValue({
    p1,
    p2,
    meterByPx: baseMapMeterByPx,
    unit,
    decimals,
    showUnitLabel,
    deltaZMeters,
  });

  // "Étiquette" style: the value prefixed by the annotation's own label.
  const labelText = getCoteLabelText({ annotation: merged, valueText });

  // Degenerate cote: both endpoints project to (nearly) the same plan
  // position — e.g. a vertical cote drawn in 3D. Render a small marker, a
  // dashed leader line and the value ("ht: …"); the label is draggable and
  // its free page-pt placement is stored in `annotation.labelOffset`.
  if (length < 0.5) {
    const labelOffset =
      dragLabelOffset ?? storedLabelOffset ?? DEGENERATE_LABEL_DEFAULT_OFFSET;
    const lx = labelOffset.x;
    const ly = labelOffset.y;
    return (
      <g {...dataProps} ref={rootGRef}>
        <g transform={`translate(${p1.x}, ${p1.y})`}>
          {/* click target — constant screen size */}
          <g
            style={
              counterScaleTransform
                ? { transform: counterScaleTransform }
                : undefined
            }
          >
            <circle
              r={10}
              fill="transparent"
              style={{ cursor: "pointer", pointerEvents: "all" }}
            />
          </g>
          {/* marker + leader + value — page points */}
          <g ref={degenerateGRef} transform={pageScaleTransform}>
            <circle
              r={3}
              fill={displayStrokeColor}
              fillOpacity={strokeOpacity}
              stroke={selected ? "#2196f3" : "none"}
              strokeWidth={selected ? 2 : 0}
              pointerEvents="none"
            />
            {/* leader line: measured point → value label */}
            <line
              x1={0}
              y1={0}
              x2={lx}
              y2={ly}
              stroke={displayStrokeColor}
              strokeOpacity={strokeOpacity}
              strokeWidth={1}
              strokeDasharray={`${DASH_PT} ${DASH_PT}`}
              pointerEvents="none"
            />
            <text
              x={lx}
              y={ly}
              textAnchor={lx >= 0 ? "start" : "end"}
              dominantBaseline={ly <= 0 ? "alphabetic" : "hanging"}
              fontSize={fontSize}
              fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
              fill={displayStrokeColor}
              data-cote-label="1"
              {...labelHitProps}
              onPointerDown={handleDegenerateLabelPointerDown}
              onPointerMove={handleDegenerateLabelPointerMove}
              onPointerUp={handleDegenerateLabelPointerUp}
              onPointerCancel={handleDegenerateLabelPointerUp}
              style={{
                userSelect: "none",
                cursor: labelCursor,
                pointerEvents: "auto",
                paintOrder: "stroke",
                stroke: "white",
                strokeWidth: TEXT_HALO_PT,
                strokeLinejoin: "round",
                touchAction: "none",
              }}
            >
              {isLabelStyle && labelText !== valueText
                ? labelText
                : `ht: ${valueText}`}
            </text>
          </g>
        </g>
      </g>
    );
  }

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

  // Text offset perpendicular to the dimension line (TEXT_OFFSET_PT).
  // Place the text on the OPPOSITE side of the dimension line from the click
  // points: with offset > 0 the dim line sits along +n, the click points are
  // at −n, so text goes at +n (away from the clicks). The textFlip case
  // (angle > 90°) inverts the local Y axis, so we negate accordingly.
  const offsetSign = effectiveOffsetPx >= 0 ? 1 : -1;
  const flipSign = textFlip ? -1 : 1;
  const textNormalSign = flipSign * offsetSign;

  // Selection indicators on the original click points — small ticks
  // perpendicular to the cote line so start/end are unambiguous. The inner
  // <g> counter-scales so the tick stays a fixed screen size.
  const selectionTicks = selected && (
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
          <line x1={0} y1={-6} x2={0} y2={6} stroke="#2196f3" strokeWidth={2} />
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
          <line x1={0} y1={-6} x2={0} y2={6} stroke="#2196f3" strokeWidth={2} />
        </g>
      </g>
    </>
  );

  // ---- "Étiquette" style ----
  // Solid, dimmed extension lines running past the bar, the bar running past
  // them, and the horizontal label tied to the bar's midpoint by a leader
  // (straight for a vertical-like cote, elbowed otherwise).
  if (isLabelStyle) {
    const geom = getCoteLabelStyleGeometry({
      p1,
      p2,
      offsetPx: effectiveOffsetPx,
      labelOffset: dragLabelOffset2d ?? storedLabelOffset2d,
      pageScale,
    });
    const { out, anchorPt, leaderPointsPt, textAnchor } = geom;
    const over = LABEL_STYLE_OVERSHOOT_PT * pageScale;
    const B1 = { x: D1.x - ux * over, y: D1.y - uy * over };
    const B2 = { x: D2.x + ux * over, y: D2.y + uy * over };
    const E1 = { x: D1.x + out.x * over, y: D1.y + out.y * over };
    const E2 = { x: D2.x + out.x * over, y: D2.y + out.y * over };
    const secondaryOpacity = strokeOpacity * LABEL_STYLE_LINE_OPACITY;
    // The bar is a drag handle (extensionOffset) while the cote is selected.
    const barDraggable = Boolean(selected) && !printMode && !isTransient;
    const textX =
      anchorPt.x +
      (textAnchor === "start"
        ? LABEL_STYLE_TEXT_GAP_PT
        : -LABEL_STYLE_TEXT_GAP_PT);

    return (
      <g {...dataProps} ref={rootGRef}>
        {/* extension lines: click point → a bit past the bar */}
        {showExtensions && (
          <>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={E1.x}
              y2={E1.y}
              stroke={displayStrokeColor}
              strokeWidth={computedStrokeWidth}
              strokeOpacity={secondaryOpacity}
              pointerEvents="none"
            />
            <line
              x1={p2.x}
              y1={p2.y}
              x2={E2.x}
              y2={E2.y}
              stroke={displayStrokeColor}
              strokeWidth={computedStrokeWidth}
              strokeOpacity={secondaryOpacity}
              pointerEvents="none"
            />
          </>
        )}

        {/* dimension bar, running a bit past the extension lines */}
        <line
          x1={B1.x}
          y1={B1.y}
          x2={B2.x}
          y2={B2.y}
          stroke={displayStrokeColor}
          strokeWidth={computedStrokeWidth}
          strokeOpacity={strokeOpacity}
          pointerEvents="stroke"
          style={{ cursor: "pointer" }}
        />

        {/* leader + label — page points, anchored on the bar's midpoint */}
        <g transform={`translate(${geom.mid.x}, ${geom.mid.y})`}>
          <g ref={labelStyleGRef} transform={pageScaleTransform}>
            <polyline
              points={leaderPointsPt.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={displayStrokeColor}
              strokeWidth={computedStrokeWidth / pageScale}
              strokeOpacity={secondaryOpacity}
              pointerEvents="none"
            />
            <text
              x={textX}
              y={anchorPt.y}
              textAnchor={textAnchor}
              dominantBaseline="central"
              fontSize={fontSize}
              fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
              fill={displayStrokeColor}
              data-cote-label="1"
              {...labelHitProps}
              onPointerDown={handleStyleLabelPointerDown}
              onPointerMove={handleStyleLabelPointerMove}
              onPointerUp={handleStyleLabelPointerUp}
              onPointerCancel={handleStyleLabelPointerUp}
              style={{
                userSelect: "none",
                cursor: labelCursor,
                pointerEvents: "auto",
                paintOrder: "stroke",
                stroke: "white",
                strokeWidth: TEXT_HALO_PT,
                strokeLinejoin: "round",
                touchAction: "none",
              }}
            >
              {labelText}
            </text>
          </g>
        </g>

        {/* selection / hover hit area along the bar — once the cote is
            selected it is the drag handle of the bar (extensionOffset,
            signed: crossing the click points flips the label's side) */}
        <line
          x1={D1.x}
          y1={D1.y}
          x2={D2.x}
          y2={D2.y}
          stroke="transparent"
          strokeWidth={16}
          {...(barDraggable ? labelHitProps : {})}
          onPointerDown={barDraggable ? handleLabelPointerDown : undefined}
          onPointerMove={barDraggable ? handleLabelPointerMove : undefined}
          onPointerUp={barDraggable ? handleLabelPointerUp : undefined}
          onPointerCancel={barDraggable ? handleLabelPointerUp : undefined}
          style={{
            cursor: barDraggable ? "grab" : "pointer",
            pointerEvents: "stroke",
            vectorEffect: "non-scaling-stroke",
            touchAction: "none",
          }}
        />

        {selectionTicks}
      </g>
    );
  }

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
            strokeDasharray={dashArray}
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
            strokeDasharray={dashArray}
            pointerEvents="none"
          />
        </>
      )}

      {/* value label — centred on dimension line midpoint, rotated, sized in
          page points (fixed vs the base map), draggable to change
          extensionOffset. The 3D value-card offset (`coteLabelOffset`) is
          3D-only (user decision): the 2D value keeps its default placement. */}
      <g transform={`translate(${mid.x}, ${mid.y}) rotate(${angleDeg})`}>
        <g transform={pageScaleTransform}>
          <text
            x={0}
            y={textNormalSign * TEXT_OFFSET_PT}
            textAnchor="middle"
            dominantBaseline={textNormalSign < 0 ? "alphabetic" : "hanging"}
            fontSize={fontSize}
            fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
            fill={displayStrokeColor}
            data-cote-label="1"
            {...labelHitProps}
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
              strokeWidth: TEXT_HALO_PT,
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

      {selectionTicks}
    </g>
  );
}
