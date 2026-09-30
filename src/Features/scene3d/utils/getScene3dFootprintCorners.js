// The 4 corners of a SCENE_3D annotation footprint: its bbox rotated by
// `rotation` degrees (clockwise on screen, SVG convention) about the bbox
// centre. Same coordinate space as the bbox (resolved pixels).
export default function getScene3dFootprintCorners(annotation) {
  const bbox = annotation?.bbox;
  if (!bbox) return [];
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const angle = ((annotation.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const dx = (sx * bbox.width) / 2;
    const dy = (sy * bbox.height) / 2;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}
