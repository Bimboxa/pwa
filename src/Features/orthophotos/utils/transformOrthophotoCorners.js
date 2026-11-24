// Corner edits of a unit orthophoto, on corners normalized [0..1] on the
// base map reference image ([tl, tr, br, bl]). The similarity is computed in
// base map PX (the normalized frame is anisotropic), then normalized back.

export function translateCorners(corners, delta) {
  return corners.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));
}

// Free move of ONE corner (deforms the image: projective placement).
export function moveCorner(corners, index, point) {
  return corners.map((p, i) => (i === index ? { x: point.x, y: point.y } : p));
}

// Rigid edit: rotation + uniform scale about the OPPOSITE corner, bringing
// corner `index` onto `point`. The quad keeps its shape.
export function rotateScaleCorners(corners, index, point, baseMapSize) {
  const W = baseMapSize?.width;
  const H = baseMapSize?.height;
  if (!W || !H) return corners;
  const toPx = (p) => ({ x: p.x * W, y: p.y * H });
  const pivot = toPx(corners[(index + 2) % 4]);
  const from = toPx(corners[index]);
  const to = toPx(point);
  const ax = from.x - pivot.x;
  const ay = from.y - pivot.y;
  const bx = to.x - pivot.x;
  const by = to.y - pivot.y;
  const den = ax * ax + ay * ay;
  if (!(den > 1e-9) || !(bx * bx + by * by > 1e-9)) return corners;
  // complex ratio z = b / a
  const zr = (bx * ax + by * ay) / den;
  const zi = (by * ax - bx * ay) / den;
  return corners.map((p) => {
    const q = toPx(p);
    const dx = q.x - pivot.x;
    const dy = q.y - pivot.y;
    return {
      x: (pivot.x + zr * dx - zi * dy) / W,
      y: (pivot.y + zi * dx + zr * dy) / H,
    };
  });
}

export function getCornersCentre(corners) {
  return {
    x: corners.reduce((s, p) => s + p.x, 0) / corners.length,
    y: corners.reduce((s, p) => s + p.y, 0) / corners.length,
  };
}
