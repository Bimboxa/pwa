import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";

// Local-only thumbnail: the transport only receives the example geometry.
export default async function renderAiTaskExample(baseMap, example, color) {
  const url = baseMap.getUrl?.();
  if (!url) throw new Error("L’aperçu du fond est indisponible.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Impossible de lire l’image du fond.");
  const image = await createImageBitmap(await response.blob());
  try {
    const size = baseMap.getImageSize();
    const points = example.points.map((p) => ({
      x: p.x * size.width,
      y: p.y * size.height,
    }));
    const style = example.previewStyle ?? {};
    const polygons = getAnnotationAsPolygons(
      {
        ...style,
        strokeWidth: style.strokeWidth ?? 2,
        type: example.type,
        closeLine: example.closeLine,
        points,
      },
      { meterByPx: style.meterByPx ?? baseMap.getMeterByPx?.() }
    );
    const bounds = [
      ...points,
      ...polygons.flatMap((polygon) => polygon.points),
    ];
    const xs = bounds.map((p) => p.x),
      ys = bounds.map((p) => p.y);
    const span = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      40
    );
    const pad = Math.max(30, span * 0.25);
    const x = Math.max(0, Math.min(...xs) - pad),
      y = Math.max(0, Math.min(...ys) - pad);
    const width = Math.min(size.width, Math.max(...xs) + pad) - x;
    const height = Math.min(size.height, Math.max(...ys) + pad) - y;
    const scale = Math.min(360 / width, 180 / height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);
    ctx.save();
    const t = baseMap.getActiveVersionTransform?.() ?? {};
    ctx.translate(t.x ?? 0, t.y ?? 0);
    ctx.scale(t.scale ?? 1, t.scale ?? 1);
    ctx.rotate(((t.rotation ?? 0) * Math.PI) / 180);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
    ctx.fillStyle = style.strokeColor ?? color;
    ctx.globalAlpha = style.strokeOpacity ?? 1;
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of [
        polygon.points,
        ...(polygon.cuts ?? []).map((cut) => cut.points),
      ]) {
        ring.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
        );
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
    return canvas.toDataURL("image/png");
  } finally {
    image.close();
  }
}
