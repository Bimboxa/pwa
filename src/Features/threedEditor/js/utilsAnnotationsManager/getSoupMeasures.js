// Measures of a triangle soup (a CSG operand or result), m³ / m². Shared by
// the permanent bake (bakeAnnotationSubtractionsService) and the mesh union
// (unionMesh3dSolids). No three.js import: only BufferGeometry duck-typing.

// Signed volume of a closed triangle soup (divergence theorem), m³.
export function getSoupVolume(geometry) {
  const p = geometry?.getAttribute?.("position");
  if (!p) return 0;
  let volume = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const ax = p.getX(i);
    const ay = p.getY(i);
    const az = p.getZ(i);
    const bx = p.getX(i + 1);
    const by = p.getY(i + 1);
    const bz = p.getZ(i + 1);
    const cx = p.getX(i + 2);
    const cy = p.getY(i + 2);
    const cz = p.getZ(i + 2);
    volume +=
      (ax * (by * cz - bz * cy) +
        ay * (bz * cx - bx * cz) +
        az * (bx * cy - by * cx)) /
      6;
  }
  return volume;
}

export const toNonIndexedVolume = (geometry) => {
  if (!geometry) return 0;
  if (!geometry.index) return getSoupVolume(geometry);
  const soup = geometry.toNonIndexed();
  const volume = getSoupVolume(soup);
  soup.dispose();
  return volume;
};

// Area of a triangle soup (sum of the triangle areas), m² — the measure of
// an OPEN host, whose volume means nothing.
export function getSoupArea(geometry) {
  const p = geometry?.getAttribute?.("position");
  if (!p) return 0;
  let area = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const abx = p.getX(i + 1) - p.getX(i);
    const aby = p.getY(i + 1) - p.getY(i);
    const abz = p.getZ(i + 1) - p.getZ(i);
    const acx = p.getX(i + 2) - p.getX(i);
    const acy = p.getY(i + 2) - p.getY(i);
    const acz = p.getZ(i + 2) - p.getZ(i);
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    area += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }
  return area;
}

export const toNonIndexedArea = (geometry) => {
  if (!geometry) return 0;
  if (!geometry.index) return getSoupArea(geometry);
  const soup = geometry.toNonIndexed();
  const area = getSoupArea(soup);
  soup.dispose();
  return area;
};
