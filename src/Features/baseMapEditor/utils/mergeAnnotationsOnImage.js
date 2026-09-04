// Merges visible annotations onto a baseMap image, producing a new image file
// and the version transform needed to align the result in the reference frame.

import { getFreeTextPageScale } from "Features/annotations/constants/freeTextConstants";
import getAnnotationLabelSizeConfig from "Features/annotations/utils/getAnnotationLabelSizeConfig";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";

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
    img.onerror = (err) =>
      reject(new Error("Failed to load image: " + err));
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

// Compute bounding box of all annotation coordinates
function getAnnotationsBounds(annotations) {
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
      default:
        // POLYLINE, POLYGON, STRIP
        expandPoints(a.points);
        if (a.cuts) {
          for (const cut of a.cuts) expandPoints(cut.points);
        }
        break;
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
  const { type, strokeWidth = 2, strokeWidthUnit } = annotation;
  if (type === "POLYGON") return 0.5;
  if (strokeWidthUnit === "CM" && meterByPx > 0) {
    return (strokeWidth * 0.01) / meterByPx;
  }
  return strokeWidth;
}

// Draw a single annotation onto the canvas context
function drawAnnotation(ctx, annotation, meterByPx) {
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
      drawPath(ctx, points, true);
      if (cuts) {
        for (const cut of cuts) {
          drawPath(ctx, cut.points, true);
        }
      }

      // Fill
      if (fillType !== "NONE") {
        ctx.fillStyle = hexToRgba(fillColor, fillOpacity);
        ctx.fill("evenodd");
      }

      // Stroke
      ctx.strokeStyle = hexToRgba(fillColor, strokeOpacity);
      ctx.lineWidth = 0.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      break;
    }

    case "POLYLINE": {
      const { points } = annotation;
      if (!points?.length || points.length < 2) return;

      ctx.beginPath();
      drawPath(ctx, points, false);
      ctx.strokeStyle = hexToRgba(strokeColor, strokeOpacity);
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      break;
    }

    case "STRIP": {
      // Draw as a filled polyline with width
      const { points } = annotation;
      if (!points?.length || points.length < 2) return;

      ctx.beginPath();
      drawPath(ctx, points, false);
      ctx.strokeStyle = hexToRgba(strokeColor || fillColor, strokeOpacity);
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
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
      ctx.fillStyle = hexToRgba(
        fillColor,
        fillOpacity
      );
      ctx.fillRect(x, y, width, height);
      ctx.restore();
      break;
    }

    case "IMAGE": {
      // IMAGE annotations are drawn asynchronously (see drawImageAnnotation)
      break;
    }

    case "TEXT": {
      const { textValue, textPoint, fontSize = 16, textColor = "#000000", fontWeight = "normal" } = annotation;
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
    const annotBounds = getAnnotationsBounds(annotations);

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

  // 2. Draw non-eraser annotations (sorted by orderIndex already)
  const normalAnnotations = annotations.filter((a) => !a.isEraser);
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
