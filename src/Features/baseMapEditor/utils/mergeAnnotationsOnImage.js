// Merges visible annotations onto a baseMap image, producing a new image file
// and the version transform needed to align the result in the reference frame.

import { getFreeTextPageScale } from "Features/annotations/constants/freeTextConstants";
import getAnnotationLabelSizeConfig from "Features/annotations/utils/getAnnotationLabelSizeConfig";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import coerceAnnotationNumericFields from "Features/annotations/utils/coerceAnnotationNumericFields";
import getDoorSwingGeometry from "Features/annotations/utils/getDoorSwingGeometry";
import isOpeningAnnotation, {
  getOpeningType,
  sortOpeningsLast,
} from "Features/annotations/utils/isOpeningAnnotation";
import { getAnnotationRingClosed } from "Features/annotations/utils/segmentFlags";
import getStripePolygons, {
  getStripChunks,
  getStripDistancePx,
  ARC_SAMPLES,
  STRIP_DASH_DEFAULTS,
} from "Features/geometry/utils/getStripePolygons";
import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";
import {
  expandArcsInPath,
  expandArcsInPathWithHiddenMap,
} from "Features/geometry/utils/arcSampling";

// On-screen constants mirrored from the SVG renderers (screen px at zoom 1 =
// image px in the flattened image).
const STRIP_DIRECTOR_WIDTH_PX = 2; // NodeStripStatic STROKE_WIDTH_DEFAULT
const STRIP_EXT_DIRECTOR_COLOR = "#00e5ff"; // NodeStripStatic isExt director
const STRIP_DASH_BAND_RATIO = 0.6; // NodeStripStatic DASH_BAND_RATIO
const OPENING_GAP_COLOR = "#ffffff"; // NodeOpeningStatic GAP_COLOR
const OPENING_SYMBOL_WIDTH_PX = 1.5; // NodeOpeningStatic SYMBOL_STROKE_SCREEN_PX
const OPENING_FRAME_WIDTH_PX = 1; // NodeOpeningStatic FRAME_STROKE_SCREEN_PX

// Standalone LABEL chip: page-pt → image-px scale in "Taille fixe" mode,
// plain image px otherwise (a screen-constant chip has no exact image size —
// 1 CSS px is flattened as 1 image px, i.e. the zoom-1 look).
function getLabelChipScale(a) {
  const { isFixedSize, pageFormat } = getAnnotationLabelSizeConfig(a);
  return isFixedSize ? getFreeTextPageScale(pageFormat, a.imageLongSidePx) : 1;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to load image: " + err));
    img.src = url;
  });
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Compute bounding box of all annotation coordinates (exported for the
// node replay: scripts/replay/mergeAnnotationsOnImageReplay.js)
export function getAnnotationsBounds(annotations, meterByPx) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function expandPoint(x, y) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  function expandPoints(points) {
    if (!points?.length) return;
    for (const p of points) {
      expandPoint(p.x, p.y);
    }
  }

  for (const a of annotations) {
    switch (a.type) {
      case "MARKER":
      case "POINT":
        if (a.point) expandPoint(a.point.x - 20, a.point.y - 20);
        if (a.point) expandPoint(a.point.x + 20, a.point.y + 20);
        break;
      case "LABEL": {
        if (a.targetPoint) expandPoint(a.targetPoint.x, a.targetPoint.y);
        if (a.labelPoint) {
          const k = getLabelChipScale(a);
          const halfW = (k * (a.width || 200)) / 2;
          expandPoint(a.labelPoint.x - halfW, a.labelPoint.y - 30 * k);
          expandPoint(a.labelPoint.x + halfW, a.labelPoint.y + 30 * k);
        }
        break;
      }
      case "FREE_TEXT": {
        if (a.targetPoint) expandPoint(a.targetPoint.x, a.targetPoint.y);
        if (a.labelPoint) {
          // width / margins are page pt — scale them to image px.
          const k = getFreeTextPageScale(a.pageFormat, a.imageLongSidePx);
          const halfW = (k * (a.width || 200)) / 2;
          expandPoint(a.labelPoint.x - halfW, a.labelPoint.y - 30 * k);
          expandPoint(a.labelPoint.x + halfW, a.labelPoint.y + 30 * k);
        }
        break;
      }
      case "IMAGE":
      case "RECTANGLE":
        if (a.bbox) {
          expandPoint(a.bbox.x, a.bbox.y);
          expandPoint(a.bbox.x + a.bbox.width, a.bbox.y + a.bbox.height);
        }
        break;
      case "TEXT":
        if (a.textPoint) {
          expandPoint(a.textPoint.x - 10, a.textPoint.y - 30);
          expandPoint(a.textPoint.x + 200, a.textPoint.y + 30);
        }
        break;
      case "STRIP": {
        // The band lies on ONE side of the director line (stripOrientation):
        // bound the offset polygons, not the stored points.
        const shapes = getStripePolygons(a, meterByPx, true);
        for (const shape of shapes) expandPoints(shape.points);
        expandPoints(a.points);
        break;
      }
      default: {
        if (isOpeningAnnotation(a)) {
          const { p1, p2, gapWidth, door } = getOpeningGeometry(a, meterByPx);
          if (p1 && p2) {
            const h = gapWidth / 2;
            for (const p of [p1, p2]) {
              expandPoint(p.x - h, p.y - h);
              expandPoint(p.x + h, p.y + h);
            }
            if (door) {
              expandPoint(door.leafEnd.x, door.leafEnd.y);
              expandPoint(door.arcEnd.x, door.arcEnd.y);
            }
          }
          break;
        }
        // POLYLINE, POLYGON: stored points + half the stroke width.
        const h = computeStrokeWidth(a, meterByPx) / 2;
        const expandPointsWithStroke = (points) => {
          if (!points?.length) return;
          for (const p of points) {
            expandPoint(p.x - h, p.y - h);
            expandPoint(p.x + h, p.y + h);
          }
        };
        expandPointsWithStroke(a.points);
        if (a.cuts) {
          for (const cut of a.cuts) expandPointsWithStroke(cut.points);
        }
        break;
      }
    }
  }

  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

// Draw a path (array of {x, y}) on canvas context
function drawPath(ctx, points, close = false) {
  if (!points?.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (close) ctx.closePath();
}

// Compute the effective stroke width in pixels
function computeStrokeWidth(annotation, meterByPx) {
  const { type, strokeWidthUnit } = annotation;
  const strokeWidth = Number(annotation.strokeWidth ?? 2);
  if (type === "POLYGON") return 0.5;
  if (strokeWidthUnit === "CM" && meterByPx > 0) {
    return (strokeWidth * 0.01) / meterByPx;
  }
  return strokeWidth;
}

// Ring of a POLYGON / closed POLYLINE / cut with its S-C-S arcs tessellated.
function getRingPoints(points, closed) {
  if (!points?.length) return [];
  return expandArcsInPath(points, ARC_SAMPLES, closed);
}

// Stroke the centerline of a POLYLINE / POLYGON the way
// NodePolylineStatic.renderContinuousStrokes does: S-C-S arcs tessellated,
// hidden segments skipped (consecutive visible segments form one continuous
// run), butt caps at run ends, round joins, `Z` when the closed ring has no
// hidden segment, "1 1" dashes for DASHED.
function strokeCenterline(ctx, annotation, { closed, color, opacity, width }) {
  const { points, strokeType = "SOLID" } = annotation;
  if (!points || points.length < 2) return;
  if (strokeType === "NONE") return;

  const { points: pts, hiddenSegmentsIdx: hidden } =
    expandArcsInPathWithHiddenMap(
      points,
      ARC_SAMPLES,
      annotation.hiddenSegmentsIdx ?? [],
      closed
    );
  const n = pts.length;
  if (n < 2) return;
  const hiddenSet = new Set(hidden ?? []);
  const segmentCount = closed ? n : n - 1;
  const isDashed = strokeType === "DASHED";

  ctx.save();
  ctx.strokeStyle = hexToRgba(color, opacity);
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.lineJoin = isDashed ? "bevel" : "round";
  ctx.setLineDash(isDashed ? [1, 1] : []);

  if (closed && hiddenSet.size === 0) {
    ctx.beginPath();
    drawPath(ctx, pts, true);
    ctx.stroke();
    ctx.restore();
    return;
  }

  let runStarted = false;
  for (let i = 0; i < segmentCount; i++) {
    if (hiddenSet.has(i)) {
      if (runStarted) ctx.stroke();
      runStarted = false;
      continue;
    }
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (!runStarted) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      runStarted = true;
    }
    ctx.lineTo(b.x, b.y);
  }
  if (runStarted) ctx.stroke();
  ctx.restore();
}

// Trace the band polygons of a STRIP (outer ring + holes) on the current
// path — caller decides fill / clip.
function traceStripShapes(ctx, shapes) {
  ctx.beginPath();
  for (const shape of shapes) {
    drawPath(ctx, shape.points, true);
    for (const cut of shape.cuts || []) {
      if (cut?.points?.length >= 3) drawPath(ctx, cut.points, true);
    }
  }
}

// STRIP — mirrors NodeStripStatic (non-selected look): the band is the
// one-sided offset polygon of the director line (getStripePolygons handles
// the CM width, stripOrientation, closeLine → annular ring, hidden segments,
// arcs and cuts), filled in strokeColor at strokeOpacity, plus the 2px
// director line. DASHED strips render as the membrane symbol: white band,
// thin outline, colored dash blocks along the band centerline.
function drawStrip(ctx, annotation, meterByPx) {
  const {
    points,
    strokeColor,
    fillColor,
    strokeOpacity = 0.7,
    strokeType,
    isExt,
  } = annotation;
  if (!points || points.length < 2) return;

  const color = strokeColor || fillColor || "#000000";
  const shapes = getStripePolygons(annotation, meterByPx, true);
  const useHatching = strokeType === "DASHED";

  if (shapes.length) {
    traceStripShapes(ctx, shapes);
    ctx.fillStyle = useHatching ? "#ffffff" : hexToRgba(color, strokeOpacity);
    ctx.fill("evenodd");

    if (useHatching) {
      // Thin outline (non-scaling 1px on screen).
      ctx.strokeStyle = hexToRgba(color, strokeOpacity);
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();

      // Colored dash blocks along the band centerline, clipped to the band.
      const distancePx = getStripDistancePx(annotation, meterByPx);
      if (distancePx) {
        const isCm = annotation.strokeWidthUnit === "CM" && meterByPx > 0;
        const toPx = (v) => (isCm ? (v * 0.01) / meterByPx : v);
        const dashPx = Math.max(
          1,
          toPx(Number(annotation.dashLength) || STRIP_DASH_DEFAULTS.dashLength)
        );
        const gapPx = Math.max(
          1,
          toPx(Number(annotation.dashGap) || STRIP_DASH_DEFAULTS.dashGap)
        );
        const { chunks } = getStripChunks(annotation);
        ctx.save();
        traceStripShapes(ctx, shapes);
        ctx.clip("evenodd");
        ctx.strokeStyle = hexToRgba(color, strokeOpacity);
        ctx.lineWidth = Math.abs(distancePx) * STRIP_DASH_BAND_RATIO;
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
        ctx.setLineDash([dashPx, gapPx]);
        for (const chunk of chunks) {
          const axis = offsetPolyline(
            expandArcsInPath(chunk, ARC_SAMPLES, false),
            distancePx / 2
          );
          if (!axis || axis.length < 2) continue;
          ctx.beginPath();
          drawPath(ctx, axis, false);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // Director line (2px on screen at zoom 1), hidden segments excluded by
  // the chunk decomposition; closed strips get a closed ring.
  const { effectiveCloseLine, effectivePoints, chunks } =
    getStripChunks(annotation);
  ctx.save();
  ctx.strokeStyle = hexToRgba(isExt ? STRIP_EXT_DIRECTOR_COLOR : color, 1);
  ctx.lineWidth = STRIP_DIRECTOR_WIDTH_PX;
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  if (effectiveCloseLine && effectivePoints.length >= 3) {
    ctx.beginPath();
    drawPath(ctx, expandArcsInPath(effectivePoints, ARC_SAMPLES, true), true);
    ctx.stroke();
  } else {
    for (const chunk of chunks) {
      ctx.beginPath();
      drawPath(ctx, expandArcsInPath(chunk, ARC_SAMPLES, false), false);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Shared opening geometry (NodeOpeningStatic): the jambs p1 / p2 sit on the
// host centerline (median line for STRIP hosts, already offset at write
// time), the gap band is the wall thickness in CM.
function getOpeningGeometry(annotation, meterByPx) {
  const a = coerceAnnotationNumericFields(annotation);
  const {
    points,
    strokeWidth = 20,
    strokeWidthUnit = "CM",
    doorHinge = "START",
    doorSide = 1,
  } = a;
  const p1 = points?.[0];
  const p2 = points?.[1];
  if (!p1 || !p2 || !Number.isFinite(p1.x) || !Number.isFinite(p2.x)) {
    return { p1: null, p2: null, gapWidth: 0, door: null, openingType: "NONE" };
  }
  const isCmUnit = strokeWidthUnit === "CM" && meterByPx > 0;
  const bandWidth = isCmUnit ? (strokeWidth * 0.01) / meterByPx : strokeWidth;
  const gapWidth = Math.max(bandWidth, 0.1);
  const openingType = getOpeningType(a);
  const door =
    openingType === "DOOR"
      ? getDoorSwingGeometry({ p1, p2, bandWidth, doorHinge, doorSide })
      : null;
  return { p1, p2, gapWidth, door, openingType };
}

// OPENING (door / window / plain gap) — mirrors NodeOpeningStatic: opaque
// white band = the wall gap (drawn AFTER the host, see sortOpeningsLast),
// then the plan symbol in strokeColor: door leaf + swing arc, thin frame
// around the gap, window centre line.
function drawOpening(ctx, annotation, meterByPx) {
  const { p1, p2, gapWidth, door, openingType } = getOpeningGeometry(
    annotation,
    meterByPx
  );
  if (!p1 || !p2) return;
  const a = coerceAnnotationNumericFields(annotation);
  const color = a.strokeColor || "#000000";
  const opacity = Number.isFinite(a.strokeOpacity) ? a.strokeOpacity : 1;

  ctx.save();
  ctx.setLineDash([]);

  // 1. Wall gap
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = OPENING_GAP_COLOR;
  ctx.lineWidth = gapWidth;
  ctx.lineCap = "butt";
  ctx.stroke();

  // 2. Door leaf + swing arc
  if (door) {
    ctx.strokeStyle = hexToRgba(color, opacity);
    ctx.lineWidth = OPENING_SYMBOL_WIDTH_PX;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(door.leafStart.x, door.leafStart.y);
    ctx.lineTo(door.leafEnd.x, door.leafEnd.y);
    ctx.stroke();

    const c = door.leafStart;
    const startAngle = Math.atan2(door.leafEnd.y - c.y, door.leafEnd.x - c.x);
    const endAngle = Math.atan2(door.arcEnd.y - c.y, door.arcEnd.x - c.x);
    // SVG sweepFlag 1 = increasing angle (clockwise on a y-down screen) =
    // canvas default direction; sweepFlag 0 → anticlockwise.
    ctx.beginPath();
    ctx.arc(c.x, c.y, door.radius, startAngle, endAngle, door.sweepFlag === 0);
    ctx.stroke();
  }

  // 3. Frame around the gap (+ window centre line)
  if (openingType === "DOOR" || openingType === "WINDOW") {
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    ctx.save();
    ctx.translate(p1.x, p1.y);
    ctx.rotate(angle);
    ctx.strokeStyle = hexToRgba(color, opacity);
    ctx.lineWidth = OPENING_FRAME_WIDTH_PX;
    ctx.lineCap = "butt";
    ctx.strokeRect(0, -gapWidth / 2, length, gapWidth);
    if (openingType === "WINDOW") {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

// Draw a single annotation onto the canvas context (exported for the replay)
export function drawAnnotation(ctx, annotation, meterByPx) {
  const {
    type,
    strokeColor,
    fillColor,
    fillOpacity = 0.8,
    strokeOpacity = 1,
    fillType = "SOLID",
  } = annotation;

  const strokeWidth = computeStrokeWidth(annotation, meterByPx);

  switch (type) {
    case "POLYGON": {
      const { points, cuts } = annotation;
      if (!points?.length) return;

      ctx.beginPath();
      drawPath(ctx, getRingPoints(points, true), true);
      if (cuts) {
        for (const cut of cuts) {
          drawPath(ctx, getRingPoints(cut.points, true), true);
        }
      }

      // Fill
      if (fillType !== "NONE") {
        ctx.fillStyle = hexToRgba(fillColor, fillOpacity);
        ctx.fill("evenodd");
      }

      // Stroke (0.5px in the polygon colour, like NodePolylineStatic)
      const ringStyle = {
        closed: true,
        color: fillColor,
        opacity: strokeOpacity,
        width: strokeWidth,
      };
      strokeCenterline(ctx, annotation, ringStyle);
      if (cuts) {
        for (const cut of cuts) {
          if (cut?.points?.length >= 2) {
            strokeCenterline(
              ctx,
              { ...cut, strokeType: annotation.strokeType },
              ringStyle
            );
          }
        }
      }
      break;
    }

    case "POLYLINE": {
      if (isOpeningAnnotation(annotation)) {
        drawOpening(ctx, annotation, meterByPx);
        break;
      }
      const { points } = annotation;
      if (!points?.length || points.length < 2) return;
      strokeCenterline(ctx, annotation, {
        closed: getAnnotationRingClosed(annotation),
        color: strokeColor,
        opacity: strokeOpacity,
        width: strokeWidth,
      });
      break;
    }

    case "STRIP": {
      drawStrip(ctx, annotation, meterByPx);
      break;
    }

    case "MARKER": {
      const { point, fillColor: markerColor } = annotation;
      if (!point) return;
      const color = markerColor || "#f44336";
      const r = 16;

      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.9);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }

    case "POINT": {
      const { point } = annotation;
      if (!point) return;
      const color = fillColor || strokeColor || "#2196f3";
      const r = 4;

      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 1);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }

    case "RECTANGLE": {
      const { bbox, rotation = 0 } = annotation;
      if (!bbox) return;
      const { x, y, width, height } = bbox;

      ctx.save();
      if (rotation) {
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-(x + width / 2), -(y + height / 2));
      }
      ctx.fillStyle = hexToRgba(fillColor, fillOpacity);
      ctx.fillRect(x, y, width, height);
      ctx.restore();
      break;
    }

    case "IMAGE": {
      // IMAGE annotations are drawn asynchronously (see drawImageAnnotation)
      break;
    }

    case "TEXT": {
      const {
        textValue,
        textPoint,
        fontSize = 16,
        textColor = "#000000",
        fontWeight = "normal",
      } = annotation;
      if (!textPoint || !textValue) return;
      ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = "middle";
      ctx.fillText(textValue, textPoint.x, textPoint.y);
      break;
    }

    case "LABEL": {
      // Standalone LABEL chip, same model as NodeLabelStatic: white chip,
      // 1px border in the annotation colour, bold centred text, 8/4 padding,
      // single-segment black leader. In "Taille fixe" mode the chip is drawn
      // in page-pt space scaled by k (see getLabelChipScale) so the flatten
      // matches the on-screen chip; otherwise 1 CSS px = 1 image px.
      const {
        targetPoint,
        labelPoint,
        width,
        textColor = "#000000",
        bgColor = "#ffffff",
      } = annotation;
      if (!targetPoint || !labelPoint) return;

      const { fontSize: cfgFontSize, isFixedSize } =
        getAnnotationLabelSizeConfig(annotation);
      const k = getLabelChipScale(annotation);
      // Screen mode keeps the historical 14px font whatever the row says.
      const fontSize = isFixedSize ? cfgFontSize : 14;
      const text = getAnnotationOwnLabel(annotation) ?? "";
      const lines = String(text).split("\n");

      ctx.save();
      ctx.translate(labelPoint.x, labelPoint.y);
      ctx.scale(k, k);

      const padX = 8;
      const padY = 4;
      const lineHeight = fontSize * 1.2;
      ctx.font = `bold ${fontSize}px "Roboto", "Helvetica", "Arial", sans-serif`;
      const maxLineWidth = Math.max(
        1,
        ...lines.map((l) => ctx.measureText(l).width)
      );
      const boxW = width || Math.max(40, maxLineWidth + 2 * padX);
      const boxH = lines.length * lineHeight + 2 * padY;
      const boxX = -boxW / 2;
      const boxY = -boxH / 2;

      // Leader (image px space: undo the chip scale for the geometry, keep
      // the 1.5px stroke constant like non-scaling-stroke).
      ctx.save();
      ctx.scale(1 / k, 1 / k);
      ctx.beginPath();
      ctx.moveTo(targetPoint.x - labelPoint.x, targetPoint.y - labelPoint.y);
      ctx.lineTo(0, 0);
      ctx.strokeStyle = hexToRgba("#000000", 0.7);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = bgColor;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = fillColor || "#2196f3";
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = textColor;
      ctx.textBaseline = "middle";
      lines.forEach((line, i) => {
        const lineW = ctx.measureText(line).width;
        const ty = boxY + padY + (i + 0.5) * lineHeight;
        ctx.fillText(line, -lineW / 2, ty);
      });
      ctx.restore();
      break;
    }

    case "FREE_TEXT": {
      // The box is MAP-FIXED: sizes are PDF points "as if the base map
      // filled an A4/A3 page" (pageFormat). Drawn in page-pt space around
      // the box centre, scaled by k = imageLongSide / pageLongSide
      // (imageLongSidePx stamped by useAnnotationsV2) — same rule as
      // NodeFreeTextStatic, so the flatten is exact.
      const {
        targetPoint,
        labelPoint,
        textContent,
        width,
        hasBackground = true,
        textColor = "#000000",
        borderColor = "#000000",
        fontFamily = "Roboto",
        fontSize = 14,
        fontWeight = "normal",
        fontItalic = false,
        fontUnderline = false,
        textAlign = "LEFT",
        hasBorder = false,
        hasPadding = true,
        hasConnector = false,
        pageFormat = "A4",
        imageLongSidePx,
      } = annotation;
      if (!labelPoint) return;

      const k = getFreeTextPageScale(pageFormat, imageLongSidePx);

      // Connector line (drawn first, under the box) — image px space.
      if (hasConnector && targetPoint) {
        ctx.beginPath();
        ctx.moveTo(targetPoint.x, targetPoint.y);
        ctx.lineTo(labelPoint.x, labelPoint.y);
        ctx.strokeStyle = hexToRgba("#000000", 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(labelPoint.x, labelPoint.y);
      ctx.scale(k, k);

      const lines = String(textContent ?? "").split("\n");
      const padX = hasPadding ? 8 : 0;
      const padY = hasPadding ? 4 : 0;
      const lineHeight = fontSize * 1.2;
      ctx.font = `${fontItalic ? "italic " : ""}${fontWeight} ${fontSize}px "${fontFamily}", system-ui, sans-serif`;
      const maxLineWidth = Math.max(
        1,
        ...lines.map((l) => ctx.measureText(l).width)
      );
      const boxW = width || maxLineWidth + 2 * padX;
      const boxH = lines.length * lineHeight + 2 * padY;
      const boxX = -boxW / 2;
      const boxY = -boxH / 2;

      if (hasBackground) {
        ctx.fillStyle = fillColor || "#ffffff";
        ctx.fillRect(boxX, boxY, boxW, boxH);
      }
      if (hasBorder) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
      }

      ctx.fillStyle = textColor;
      ctx.textBaseline = "middle";
      lines.forEach((line, i) => {
        const lineW = ctx.measureText(line).width;
        const tx =
          textAlign === "CENTER"
            ? -lineW / 2
            : textAlign === "RIGHT"
              ? boxX + boxW - padX - lineW
              : boxX + padX;
        const ty = boxY + padY + (i + 0.5) * lineHeight;
        ctx.fillText(line, tx, ty);
        if (fontUnderline && line) {
          ctx.beginPath();
          ctx.moveTo(tx, ty + fontSize * 0.5);
          ctx.lineTo(tx + lineW, ty + fontSize * 0.5);
          ctx.strokeStyle = textColor;
          ctx.lineWidth = Math.max(1, fontSize / 14);
          ctx.stroke();
        }
      });

      ctx.restore();
      break;
    }

    default:
      break;
  }
}

// Draw an IMAGE-type annotation (async because it loads an image)
async function drawImageAnnotation(ctx, annotation) {
  const { bbox, image } = annotation;
  if (!bbox || !image) return;
  const src = image.imageUrlClient;
  if (!src) return;

  try {
    const img = await loadImage(src);
    const { x, y, width, height } = bbox;
    const rotation = annotation.rotation || 0;

    ctx.save();
    if (rotation) {
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-(x + width / 2), -(y + height / 2));
    }
    ctx.globalAlpha = annotation.opacity ?? 1;
    ctx.drawImage(img, x, y, width, height);
    ctx.globalAlpha = 1;
    ctx.restore();
  } catch (e) {
    console.warn("Failed to draw image annotation", e);
  }
}

// Draw an eraser annotation (uses destination-out to erase pixels)
function drawEraserAnnotation(ctx, annotation) {
  const { points, cuts } = annotation;
  if (!points?.length) return;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";

  ctx.beginPath();
  drawPath(ctx, points, true);
  if (cuts) {
    for (const cut of cuts) {
      drawPath(ctx, cut.points, true);
    }
  }
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fill("evenodd");
  ctx.restore();
}

/**
 * Merge annotations onto a baseMap image.
 *
 * @param {Object} params
 * @param {string} params.imageUrl - URL of the current baseMap image
 * @param {Object} params.imageTransform - current version transform {x, y, rotation, scale}
 * @param {Object} params.refSize - reference coordinate size {width, height}
 * @param {Array} params.annotations - resolved annotations (pixel coordinates)
 * @param {number} [params.meterByPx] - meter per pixel ratio (for CM stroke widths)
 * @returns {Promise<{file: File, transform: {x, y, rotation, scale}}>}
 */
export default async function mergeAnnotationsOnImage({
  imageUrl,
  imageTransform = { x: 0, y: 0, rotation: 0, scale: 1 },
  refSize,
  annotations,
  meterByPx,
  clipToImage = false,
}) {
  if (!imageUrl || !annotations?.length) return null;

  const baseImg = await loadImage(imageUrl);

  // Compute the area covered by the baseMap image in the reference frame
  const t = imageTransform;
  const imgLeft = t.x;
  const imgTop = t.y;
  const imgRight = t.x + baseImg.width * t.scale;
  const imgBottom = t.y + baseImg.height * t.scale;

  let minX, minY, maxX, maxY;

  if (clipToImage) {
    // Keep canvas exactly at the base image bounds
    minX = Math.floor(imgLeft);
    minY = Math.floor(imgTop);
    maxX = Math.ceil(imgRight);
    maxY = Math.ceil(imgBottom);
  } else {
    // Compute the bounding box of all annotations
    const annotBounds = getAnnotationsBounds(annotations, meterByPx);

    // Determine the total bounds (image + annotations)
    minX = Math.min(imgLeft, 0);
    minY = Math.min(imgTop, 0);
    maxX = Math.max(imgRight, refSize.width);
    maxY = Math.max(imgBottom, refSize.height);

    if (annotBounds) {
      minX = Math.min(minX, annotBounds.minX);
      minY = Math.min(minY, annotBounds.minY);
      maxX = Math.max(maxX, annotBounds.maxX);
      maxY = Math.max(maxY, annotBounds.maxY);
    }

    // Add a small margin
    const margin = 2;
    minX = Math.floor(minX - margin);
    minY = Math.floor(minY - margin);
    maxX = Math.ceil(maxX + margin);
    maxY = Math.ceil(maxY + margin);
  }

  const canvasW = maxX - minX;
  const canvasH = maxY - minY;

  // The offset to convert reference coordinates to canvas coordinates
  const offsetX = -minX;
  const offsetY = -minY;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");

  // Apply offset so we draw in reference coordinates
  ctx.translate(offsetX, offsetY);

  // 1. Draw the baseMap image at its transform position
  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scale, t.scale);
  ctx.drawImage(baseImg, 0, 0);
  ctx.restore();

  // 2. Draw non-eraser annotations (sorted by orderIndex already). Hidden
  // rows are skipped like on screen, and openings go LAST: they paint the
  // white wall gap over their host (StaticMapContent / sortOpeningsLast).
  const normalAnnotations = sortOpeningsLast(
    annotations.filter((a) => !a.isEraser && !a.hidden)
  );
  const eraserAnnotations = annotations.filter((a) => a.isEraser);

  // Draw IMAGE annotations first (async)
  for (const a of normalAnnotations) {
    if (a.type === "IMAGE") {
      await drawImageAnnotation(ctx, a);
    }
  }

  // Draw other annotations
  for (const a of normalAnnotations) {
    if (a.type !== "IMAGE") {
      drawAnnotation(ctx, a, meterByPx);
    }
  }

  // 3. Draw eraser annotations (destination-out)
  for (const a of eraserAnnotations) {
    drawEraserAnnotation(ctx, a);
  }

  // 3b. Fill erased (transparent) areas with white background
  if (eraserAnnotations.length > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to canvas coordinates
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 4. Export canvas to file
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  const file = new File([blob], "merged_annotations.png", {
    type: "image/png",
  });

  // 5. Compute the new version transform
  // The new image starts at (minX, minY) in the reference frame
  const newTransform = {
    x: minX,
    y: minY,
    rotation: 0,
    scale: 1,
  };

  return { file, transform: newTransform };
}
