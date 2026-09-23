// Homothety of an IMAGE bbox (base-map px, unrotated frame) about a pivot.
// The SVG rotation is applied around the bbox centre, so moving the centre
// with the homothety and scaling the size keeps the pivot fixed on screen
// whatever the rotation.
export default function getScaledImageBbox({ bboxPx, pivot, factor }) {
  if (!bboxPx || !(factor > 0)) return bboxPx;
  const cx = bboxPx.x + bboxPx.width / 2;
  const cy = bboxPx.y + bboxPx.height / 2;
  const px = pivot?.x ?? cx;
  const py = pivot?.y ?? cy;
  const ncx = px + factor * (cx - px);
  const ncy = py + factor * (cy - py);
  const width = bboxPx.width * factor;
  const height = bboxPx.height * factor;
  return { x: ncx - width / 2, y: ncy - height / 2, width, height };
}
