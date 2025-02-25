export default function createHatchingPattern({color, lineWidth, dim}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  ctx.strokeStyle = color ?? "black";
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(0, dim);
  ctx.lineTo(dim, 0);
  ctx.stroke();

  return ctx.createPattern(canvas, "repeat");
}
