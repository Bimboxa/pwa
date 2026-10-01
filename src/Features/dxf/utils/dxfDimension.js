// When no cached dimension block is present, reconstruct linear/aligned
// dimensions from their definition points. Other dimension types need the
// cached block to preserve the authored arrows and text.
export default function dimensionFallback(entity, header = {}) {
  const type = (entity.dimensionType ?? 0) & 7;
  if (type !== 0 && type !== 1) return null;
  const a = entity.linearOrAngularPoint1,
    b = entity.linearOrAngularPoint2,
    anchor = entity.anchorPoint;
  if (
    ![a, b, anchor].every(
      (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
    )
  )
    return null;
  const angle =
    type === 1
      ? Math.atan2(b.y - a.y, b.x - a.x)
      : ((entity.angle ?? 0) * Math.PI) / 180;
  const u = { x: Math.cos(angle), y: Math.sin(angle) },
    n = { x: -Math.sin(angle), y: Math.cos(angle) };
  const project = (p) => {
    const distance = (anchor.x - p.x) * n.x + (anchor.y - p.y) * n.y;
    return { x: p.x + distance * n.x, y: p.y + distance * n.y };
  };
  const p = project(a),
    q = project(b),
    length = Math.hypot(q.x - p.x, q.y - p.y);
  if (!(length > 0)) return null;
  const height =
    (header.$DIMTXT > 0 ? header.$DIMTXT : length * 0.025) *
    (header.$DIMSCALE > 0 ? header.$DIMSCALE : 1);
  const line = (a, b) => ({ type: "LINE", vertices: [a, b] });
  const tick = (point) =>
    line(
      {
        x: point.x - ((u.x + n.x) * height) / 3,
        y: point.y - ((u.y + n.y) * height) / 3,
      },
      {
        x: point.x + ((u.x + n.x) * height) / 3,
        y: point.y + ((u.y + n.y) * height) / 3,
      }
    );
  const children = [line(a, p), line(b, q), line(p, q), tick(p), tick(q)];
  if (entity.text !== " ") {
    const decimals = Math.max(0, Math.min(8, header.$DIMDEC ?? 2));
    const measured =
      (entity.actualMeasurement ?? length) * (header.$DIMLFAC || 1);
    const label = measured.toFixed(decimals);
    children.push({
      type: "MTEXT",
      text: (entity.text || "<>").replace(/<>/g, label),
      position: entity.middleOfText ?? {
        x: (p.x + q.x) / 2 + n.x * height,
        y: (p.y + q.y) / 2 + n.y * height,
      },
      textHeight: height,
      textWidth: 0,
      attachment: 5,
      angle,
    });
  }
  return children;
}
