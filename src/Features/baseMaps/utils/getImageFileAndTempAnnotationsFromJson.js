import { nanoid } from "@reduxjs/toolkit";

/**
 * Parse a JSON payload describing a base map and its polylines.
 * Returns a generated image file (PNG) along with normalized temp annotations
 * that can be injected in the map editor.
 *
 * @param {string|object} inputJson - JSON string or already parsed object
 * @returns {Promise<{
 *   imageFile: File,
 *   width: number,
 *   height: number,
 *   meterByPx: number|null,
 *   tempAnnotations: Array<object>
 * }>}
 */
export default async function getImageFileAndTempAnnotationsFromJson(
  inputJson
) {
  if (inputJson == null) {
    throw new Error("A JSON payload is required.");
  }

  const data =
    typeof inputJson === "string"
      ? JSON.parse(inputJson.trim())
      : { ...inputJson };

  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON payload.");
  }

  const image = data.image ?? {};
  const width = Number(image.width);
  const height = Number(image.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("image.width and image.height must be positive numbers.");
  }

  const meterByPx = Number(image.meterByPx);
  const polylines = Array.isArray(data.polylines) ? data.polylines : [];

  const normalizedPolylines = polylines.map((polyline, index) =>
    normalizePolyline(polyline, index, width, height)
  );

  const tempAnnotations = normalizedPolylines.map((polyline) => ({
    id: polyline.id,
    type: "POLYLINE",
    description: polyline.description,
    points: polyline.points,
    cuts: polyline.cuts,
    fillColor: polyline.fillColor,
    fillType: polyline.fillType,
    fillOpacity: polyline.fillOpacity,
    strokeColor: polyline.strokeColor,
    strokeWidth: polyline.strokeWidth,
    strokeOpacity: polyline.strokeOpacity,
    closeLine: polyline.isClosed,
    isTemp: true,
  }));

  const imageFile = await drawBaseMapImage({
    width,
    height,
    comment: image.comment,
    backgroundColor: image.backgroundColor ?? "#ffffff",
    //polylines: normalizedPolylines,
    polylines: [],
  });

  return {
    imageFile,
    width,
    height,
    meterByPx: Number.isFinite(meterByPx) ? meterByPx : null,
    tempAnnotations,
  };
}

function normalizePolyline(polyline = {}, index, width, height) {
  const id = polyline.id ?? `json-polyline-${index + 1}-${nanoid(6)}`;
  const points = normalizePoints(polyline.points, width, height);
  const cuts = Array.isArray(polyline.cuts)
    ? polyline.cuts.map((cut, cutIndex) => ({
        id: cut?.id ?? `${id}-cut-${cutIndex + 1}`,
        description: cut?.description,
        points: normalizePoints(cut?.points, width, height),
      }))
    : [];

  return {
    id,
    description: polyline.description,
    points,
    cuts,
    fillColor: polyline.fillColor ?? null,
    fillType: (polyline.fillType ?? "SOLID").toUpperCase(),
    fillOpacity: getOpacity(polyline.fillOpacity, 1),
    strokeColor: polyline.strokeColor ?? "#111111",
    strokeWidth: Number(polyline.strokeWidth) || 2,
    strokeWidthUnit: "PX",
    strokeOpacity: getOpacity(polyline.strokeOpacity, 1),
    isClosed: polyline.isClosed !== false,
    type: "POLYLINE",
  };
}

function normalizePoints(points, width, height) {
  if (!Array.isArray(points)) return [];
  return points
    .map((point) => {
      const x = normalizeCoordinate(point?.x, width);
      const y = normalizeCoordinate(point?.y, height);
      return { x, y };
    })
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= 0 &&
        point.x <= 1 &&
        point.y >= 0 &&
        point.y <= 1
    );
}

function normalizeCoordinate(value, dimension) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;

  if (Math.abs(number) <= 1) {
    return clamp01(number);
  }

  // Interpret values <= 100 as percentages.
  if (number >= -100 && number <= 100) {
    return clamp01(number / 100);
  }

  return clamp01(number / dimension);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function getOpacity(value, fallback) {
  const opacity = Number(value);
  if (!Number.isFinite(opacity)) return fallback;
  return clamp01(opacity);
}

async function drawBaseMapImage({
  width,
  height,
  polylines,
  backgroundColor,
  comment,
}) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, width, height);

  polylines.forEach((polyline) => drawPolyline(ctx, width, height, polyline));

  if (comment) {
    drawComment(ctx, width, height, comment);
  }

  const blob = await canvasToBlob(canvas);
  const fileName = `base-map-json-${Date.now()}.png`;
  return new File([blob], fileName, { type: "image/png" });
}

function createCanvas(width, height) {
  if (typeof document !== "undefined" && document.createElement) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error("Canvas API is not available in the current environment.");
}

function drawPolyline(ctx, width, height, polyline) {
  const pointsPx = polyline.points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));

  if (pointsPx.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pointsPx[0].x, pointsPx[0].y);
  for (let i = 1; i < pointsPx.length; i += 1) {
    ctx.lineTo(pointsPx[i].x, pointsPx[i].y);
  }
  if (polyline.isClosed) {
    ctx.closePath();
  }

  polyline.cuts.forEach((cut) => {
    const cutPoints = cut.points.map((point) => ({
      x: point.x * width,
      y: point.y * height,
    }));
    if (cutPoints.length < 2) return;
    ctx.moveTo(cutPoints[0].x, cutPoints[0].y);
    for (let i = 1; i < cutPoints.length; i += 1) {
      ctx.lineTo(cutPoints[i].x, cutPoints[i].y);
    }
    ctx.closePath();
  });

  if (polyline.fillColor) {
    ctx.save();
    ctx.globalAlpha = polyline.fillOpacity;
    ctx.fillStyle = getFillStyle(ctx, polyline.fillColor, polyline.fillType);
    ctx.fill("evenodd");
    ctx.restore();
  }

  ctx.globalAlpha = polyline.strokeOpacity;
  ctx.strokeStyle = polyline.strokeColor;
  ctx.lineWidth = polyline.strokeWidth;
  ctx.stroke();

  ctx.restore();
}

function getFillStyle(ctx, color, fillType) {
  if (fillType === "HATCH") {
    if (typeof document === "undefined" || !document.createElement) {
      return color;
    }
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = 12;
    patternCanvas.height = 12;
    const patternCtx = patternCanvas.getContext("2d");
    patternCtx.strokeStyle = color;
    patternCtx.lineWidth = 2;
    patternCtx.beginPath();
    patternCtx.moveTo(0, 12);
    patternCtx.lineTo(12, 0);
    patternCtx.stroke();
    return ctx.createPattern(patternCanvas, "repeat");
  }

  return color;
}

function drawComment(ctx, width, height, comment) {
  ctx.save();
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.textBaseline = "bottom";
  ctx.fillText(comment, 16, height - 16);
  ctx.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to export canvas to blob."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
