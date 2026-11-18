import { memo, useCallback, useMemo, useRef, useState } from "react";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import getAnnotationOffsetLineConfig, {
  getOffsetLinePxPerUnit,
  isOffsetLineLocked,
  OFFSET_LINE_LABEL_SOURCE_ANNOTATION,
  OFFSET_LINE_LABEL_SOURCE_TEMPLATE,
} from "Features/annotations/utils/getAnnotationOffsetLineConfig";
import getOffsetLineGeometry from "Features/annotations/utils/getOffsetLineGeometry";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import getCotePageScale from "Features/annotations/utils/getCotePageScale";
import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import getStrokeDasharray from "Features/mapEditorGeneric/utils/getStrokeDasharray";

// Offset line ink, in page pt of the base map's print zone (see
// getCotePageScale): FIXED relative to the plan, like the cotes.
const TEXT_GAP_PT = 3;
const TEXT_HALO_PT = 2;
// Between the label and the segment length when both are shown.
const TEXT_SEPARATOR = " · ";
// Rough advance of one glyph, as a ratio of the font size — only used to drop
// the label of a segment too short to carry it.
const GLYPH_WIDTH_RATIO = 0.55;

// Screen px: grab band around the line, move threshold before a press
// becomes a drag (below it, the press is a plain click = selection).
const HIT_STROKE_WIDTH_PX = 14;
const DRAG_THRESHOLD_PX = 3;

const FONT_FAMILY = '"Roboto", "Helvetica", "Arial", sans-serif';

// Keeps the text readable: never upside down, vertical runs read bottom-up.
function getUprightAngle(angle) {
  let a = angle;
  if (a > 89.5) a -= 180;
  if (a < -90.5) a += 180;
  return a;
}

// "Ligne de déport" of a POLYLINE / POLYGON / STRIP: a thin line parallel to
// the annotation's main line (see getAnnotationOffsetLineConfig), optionally
// carrying the annotation label and / or the segment length (formatted like a
// cote, measured on the main line) along each segment. Rendered next to the
// annotation's own node by NodeAnnotationStatic.
//
// Like NodeCoteStatic, this node owns its drag: the line is a grab handle
// whose perpendicular drag changes the signed offset (crossing the main line
// flips the side). `data-interaction="draggable"` + `data-drag-owner="node"`
// make InteractionLayer absorb the gesture (no pan, no whole-annotation move)
// and select the annotation on a plain click. The label is a plain selection
// target through the `data-node-*` attributes of the root group.
function NodeOffsetLineStatic({ annotation, printMode, baseMapMeterByPx }) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // state

  const rootGRef = useRef(null);
  const dragRef = useRef(null);
  // In the unit of the stored offset (`offsetUnit`).
  const [dragOffset, setDragOffset] = useState(null);

  // helpers

  const annotationId = annotation?.id;
  const type = annotation?.type;
  const points = annotation?.points;
  const closeLine = type === "POLYGON" || Boolean(annotation?.closeLine);

  const {
    enabled,
    offset,
    offsetUnit,
    strokeWidth,
    dashed,
    fontSize,
    labelSource,
    showLength,
    lengthUnit,
    lengthDecimals,
    showLengthUnit,
  } = getAnnotationOffsetLineConfig(annotation);
  const locked = isOffsetLineLocked(
    annotation?.annotationTemplateProps?.overrideFields
  );
  const draggable = !printMode && Boolean(annotationId) && !locked;

  const pageScale = getCotePageScale(annotation);
  // STRIP: the stored points are one EDGE of the band, which extends toward
  // the left normal × stripOrientation (getStripDistancePx). A positive
  // offset is the side OPPOSITE the band, so the offset line follows the
  // band when it is flipped. Other types: positive = right of the drawing
  // direction.
  const sideSign =
    type === "STRIP" && (annotation?.stripOrientation ?? 1) < 0 ? -1 : 1;
  // Image px per offset unit: page pt, or real-world cm (base map scale).
  const pxPerUnit = getOffsetLinePxPerUnit({
    offsetUnit,
    pageScale,
    meterByPx: baseMapMeterByPx,
  });
  // Signed along the right-of-direction normal of getOffsetLineGeometry.
  const offsetPx = (dragOffset ?? offset) * pxPerUnit * sideSign;

  const geometry = useMemo(
    () =>
      enabled
        ? getOffsetLineGeometry({ points, closeLine, offset: offsetPx })
        : null,
    [enabled, points, closeLine, offsetPx]
  );

  const color =
    (type === "POLYGON" ? annotation?.fillColor : annotation?.strokeColor) ??
    "#000000";
  // The template's label, the annotation's own one (not the entity /
  // template fallback carried by `annotation.label`), or none.
  let labelText = "";
  if (labelSource === OFFSET_LINE_LABEL_SOURCE_TEMPLATE) {
    labelText = annotation?.annotationTemplateProps?.label ?? "";
  } else if (labelSource === OFFSET_LINE_LABEL_SOURCE_ANNOTATION) {
    labelText = getAnnotationOwnLabel(annotation) ?? "";
  }

  // helpers - pointer position in image px

  const getImagePoint = useCallback((e) => {
    const root = rootGRef.current;
    const ctm = root?.getScreenCTM?.();
    const svg = root?.ownerSVGElement;
    if (!ctm || !svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  // handlers

  const handlePointerDown = useCallback(
    (e) => {
      if (!draggable || !geometry) return;
      if (e.button !== undefined && e.button !== 0) return;
      // Shift+press belongs to the lasso / multi-selection toggle.
      if (e.shiftKey) return;
      const imgPt = getImagePoint(e);
      if (!imgPt) return;

      // The drag slides along the normal of the grabbed segment: the main
      // segment whose offset copy is the closest to the pointer.
      let grabbed = null;
      let bestDistance = Infinity;
      geometry.segments.forEach((segment) => {
        const ax = segment.a.x + segment.nx * offsetPx;
        const ay = segment.a.y + segment.ny * offsetPx;
        const along = Math.min(
          Math.max(
            (imgPt.x - ax) * segment.tx + (imgPt.y - ay) * segment.ty,
            0
          ),
          segment.length
        );
        const distance = Math.hypot(
          imgPt.x - (ax + segment.tx * along),
          imgPt.y - (ay + segment.ty * along)
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          grabbed = segment;
        }
      });
      if (!grabbed) return;

      dragRef.current = {
        initialImgPt: { x: imgPt.x, y: imgPt.y },
        initialOffsetPx: offsetPx,
        nx: grabbed.nx,
        ny: grabbed.ny,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      // Pointer-only stop, no preventDefault: the compatibility mousedown
      // must still reach InteractionLayer (see NodeCoteStatic).
      e.stopPropagation();
    },
    [draggable, geometry, offsetPx, getImagePoint]
  );

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved) {
        const distance = Math.hypot(
          e.clientX - drag.startClient.x,
          e.clientY - drag.startClient.y
        );
        if (distance <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
      }
      const imgPt = getImagePoint(e);
      if (!imgPt) return;
      const deltaPerp =
        (imgPt.x - drag.initialImgPt.x) * drag.nx +
        (imgPt.y - drag.initialImgPt.y) * drag.ny;
      setDragOffset(
        ((drag.initialOffsetPx + deltaPerp) / pxPerUnit) * sideSign
      );
      e.stopPropagation();
    },
    [getImagePoint, pxPerUnit, sideSign]
  );

  const handlePointerUp = useCallback(
    async (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      try {
        e.target.releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      e.stopPropagation();
      // Plain click: nothing to persist, InteractionLayer selects.
      if (dragOffset === null) return;
      try {
        // Own values only: the other keys keep following the template. The
        // unit is stored with the value it qualifies.
        await updateAnnotation({
          id: annotationId,
          offsetLine: {
            ...(annotation?.offsetLine ?? {}),
            offset: Math.round(dragOffset * 10) / 10,
            offsetUnit,
          },
        });
      } finally {
        setDragOffset(null);
      }
    },
    [
      annotationId,
      annotation?.offsetLine,
      dragOffset,
      offsetUnit,
      updateAnnotation,
    ]
  );

  // render

  if (!geometry) return null;

  const pointsAttr = geometry.points.map((p) => `${p.x},${p.y}`).join(" ");
  const LineTag = geometry.closed ? "polygon" : "polyline";
  // Dash pattern in page pt, like the stroke: fixed relative to the plan.
  const dashArray = dashed
    ? getStrokeDasharray(strokeWidth)
        .split(" ")
        .map((v) => Number(v) * pageScale)
        .join(" ")
    : undefined;
  const side = offsetPx < 0 ? -1 : 1;
  const textShiftPx = side * (TEXT_GAP_PT + fontSize / 2) * pageScale;
  // No length without a scale on the base map (getCoteDisplayValue's "—").
  const hasScale = Number.isFinite(baseMapMeterByPx) && baseMapMeterByPx > 0;
  const labels = geometry.labels
    .map((label) => {
      const lengthText =
        showLength && hasScale
          ? getCoteDisplayValue({
              p1: { x: 0, y: 0 },
              p2: { x: label.length, y: 0 },
              meterByPx: baseMapMeterByPx,
              unit: lengthUnit,
              decimals: lengthDecimals,
              showUnitLabel: showLengthUnit,
            })
          : "";
      const text = [labelText, lengthText].filter(Boolean).join(TEXT_SEPARATOR);
      return { ...label, text };
    })
    .filter(
      (label) =>
        label.text &&
        label.length >=
          label.text.length * fontSize * GLYPH_WIDTH_RATIO * pageScale
    );

  return (
    <g
      ref={rootGRef}
      data-node-id={annotationId}
      data-node-entity-id={annotation?.entityId}
      data-node-listing-id={annotation?.listingId}
      data-node-type="ANNOTATION"
      data-annotation-type={type}
    >
      <LineTag
        points={pointsAttr}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * pageScale}
        strokeDasharray={dashArray}
        strokeLinejoin="miter"
        pointerEvents="none"
      />

      {labels.map((label, index) => (
        <g
          key={index}
          transform={`translate(${label.x + label.nx * textShiftPx}, ${
            label.y + label.ny * textShiftPx
          }) rotate(${getUprightAngle(label.angle)}) scale(${pageScale})`}
        >
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontFamily={FONT_FAMILY}
            fill={color}
            style={{
              userSelect: "none",
              cursor: "pointer",
              pointerEvents: printMode ? "none" : "auto",
              paintOrder: "stroke",
              stroke: "white",
              strokeWidth: TEXT_HALO_PT,
              strokeLinejoin: "round",
            }}
          >
            {label.text}
          </text>
        </g>
      ))}

      {/* hit band along the line: selection target, and the drag handle of
          the offset (signed: crossing the main line flips the side) */}
      {!printMode && (
        <LineTag
          points={pointsAttr}
          fill="none"
          stroke="transparent"
          strokeWidth={HIT_STROKE_WIDTH_PX}
          {...(draggable
            ? {
                "data-interaction": "draggable",
                "data-node-id": annotationId,
                "data-drag-owner": "node",
              }
            : {})}
          onPointerDown={draggable ? handlePointerDown : undefined}
          onPointerMove={draggable ? handlePointerMove : undefined}
          onPointerUp={draggable ? handlePointerUp : undefined}
          onPointerCancel={draggable ? handlePointerUp : undefined}
          style={{
            cursor: draggable ? "grab" : "pointer",
            pointerEvents: "stroke",
            vectorEffect: "non-scaling-stroke",
            touchAction: "none",
          }}
        />
      )}
    </g>
  );
}

export default memo(NodeOffsetLineStatic);
