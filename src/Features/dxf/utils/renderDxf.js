import { dxfPointToPixel } from "./dxfFrame.js";

function drawText(context, object, frame) {
  const center = dxfPointToPixel(object.center, frame);
  const fontSize = object.textHeight * frame.scale;
  const width = object.textWidth * frame.scale;
  const lines = object.text.split("\n");
  context.save();
  context.translate(center.x, center.y);
  context.rotate(-object.rotation);
  context.fillStyle = object.color;
  context.font = `${fontSize}px Arial`;
  context.textAlign = object.textAlign.toLowerCase();
  context.textBaseline = "middle";
  const x =
    object.textAlign === "LEFT"
      ? -width / 2
      : object.textAlign === "RIGHT"
        ? width / 2
        : 0;
  lines.forEach((line, index) =>
    context.fillText(line, x, (index - (lines.length - 1) / 2) * fontSize * 1.2)
  );
  context.restore();
}

function drawPolygon(context, object, frame) {
  context.beginPath();
  const pixels = [];
  for (const ring of [object.points, ...(object.holes ?? [])]) {
    ring.forEach((point, index) => {
      const p = dxfPointToPixel(point, frame);
      pixels.push(p);
      if (index === 0) context.moveTo(p.x, p.y);
      else context.lineTo(p.x, p.y);
    });
    context.closePath();
  }
  context.fillStyle = object.color;
  context.strokeStyle = object.color;
  if (object.fillType === "HATCHING") {
    context.save();
    context.clip("evenodd");
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const p of pixels) {
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
    }
    context.beginPath();
    context.lineWidth = 2;
    const height = bottom - top;
    for (let x = left - height; x <= right; x += 12) {
      context.moveTo(x, bottom);
      context.lineTo(x + height, top);
    }
    context.stroke();
    context.restore();
  } else context.fill("evenodd");
}

// The preview and the stored reference image use exactly the same geometry.
export function drawDxf(context, drawing, frame, hiddenLayers = new Set()) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, frame.width, frame.height);
  context.lineWidth = 1;
  context.lineJoin = "round";
  for (const object of drawing.objects) {
    if (hiddenLayers.has(object.layer)) continue;
    if (object.kind === "TEXT") {
      drawText(context, object, frame);
      continue;
    }
    if (object.kind === "POLYGON") {
      drawPolygon(context, object, frame);
      continue;
    }
    context.beginPath();
    object.points.forEach((point, index) => {
      const p = dxfPointToPixel(point, frame);
      if (index === 0) context.moveTo(p.x, p.y);
      else context.lineTo(p.x, p.y);
    });
    if (object.closed) context.closePath();
    context.strokeStyle = object.color;
    context.stroke();
  }
}

export async function renderDxfFile(drawing, frame, hiddenLayers, name) {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le rendu de l’image est indisponible.");
  drawDxf(context, drawing, frame, hiddenLayers);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Impossible de créer l’image du DXF.");
  return new File([blob], name, { type: "image/png" });
}
