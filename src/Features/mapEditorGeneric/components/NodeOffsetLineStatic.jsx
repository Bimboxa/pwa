import { memo, useCallback, useMemo, useRef, useState } from "react";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import getAnnotationOffsetLineConfig, {
  isOffsetLineLocked,
} from "Features/annotations/utils/getAnnotationOffsetLineConfig";
import getOffsetLineGeometry from "Features/annotations/utils/getOffsetLineGeometry";
import getCotePageScale from "Features/annotations/utils/getCotePageScale";

// Offset line ink, in page pt of the base map's print zone (see
// getCotePageScale): FIXED relative to the plan, like the cotes.
const STROKE_WIDTH_PT = 1;
const TEXT_GAP_PT = 3;
const TEXT_HALO_PT = 2;
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
// carrying the annotation label along each segment. Rendered next to the
// annotation's own node by NodeAnnotationStatic.
//
// Like NodeCoteStatic, this node owns its drag: the line is a grab handle
// whose perpendicular drag changes the signed offset (crossing the main line
// flips the side). `data-interaction="draggable"` + `data-drag-owner="node"`
// make InteractionLayer absorb the gesture (no pan, no whole-annotation move)
// and select the annotation on a plain click. The label is a plain selection
// target through the `data-node-*` attributes of the root group.
function NodeOffsetLineStatic({ annotation, printMode }) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // state

  const rootGRef = useRef(null);
  const dragRef = useRef(null);
  const [dragOffsetPt, setDragOffsetPt] = useState(null);

  // helpers

  const annotationId = annotation?.id;
  const type = annotation?.type;
  const points = annotation?.points;
  const closeLine = type === "POLYGON" || Boolean(annotation?.closeLine);

  const { enabled, offset, fontSize, showLabel } =
    getAnnotationOffsetLineConfig(annotation);
  const locked = isOffsetLineLocked(
    annotation?.annotationTemplateProps?.overrideFields
  );
  const draggable = !printMode && Boolean(annotationId) && !locked;

  const pageScale = getCotePageScale(annotation);
  const offsetPt = dragOffsetPt ?? offset;
  const offsetPx = offsetPt * pageScale;

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
  const labelText = showLabel
    ? (annotation?.label ?? annotation?.annotationTemplateProps?.label ?? "")
    : "";

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
      setDragOffsetPt((drag.initialOffsetPx + deltaPerp) / pageScale);
      e.stopPropagation();
    },
    [getImagePoint, pageScale]
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
      if (dragOffsetPt === null) return;
      try {
        // Own values only: the other keys keep following the template.
        await updateAnnotation({
          id: annotationId,
          offsetLine: {
            ...(annotation?.offsetLine ?? {}),
            offset: Math.round(dragOffsetPt * 10) / 10,
          },
        });
      } finally {
        setDragOffsetPt(null);
      }
    },
    [annotationId, annotation?.offsetLine, dragOffsetPt, updateAnnotation]
  );

  // render

  if (!geometry) return null;

  const pointsAttr = geometry.points.map((p) => `${p.x},${p.y}`).join(" ");
  const LineTag = geometry.closed ? "polygon" : "polyline";
  const side = offsetPx < 0 ? -1 : 1;
  const textShiftPx = side * (TEXT_GAP_PT + fontSize / 2) * pageScale;
  const textWidthPx =
    labelText.length * fontSize * GLYPH_WIDTH_RATIO * pageScale;
  const labels = labelText
    ? geometry.labels.filter((label) => label.length >= textWidthPx)
    : [];

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
        strokeWidth={STROKE_WIDTH_PT * pageScale}
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
            {labelText}
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
