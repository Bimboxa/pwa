import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld";
import worldToBaseMapNormalized from "./worldToBaseMapNormalized";

// 2D affine transform taking a pixel of `source` (its reference frame, the
// one its annotations are resolved in) to the pixel frame of `host`, through
// both 3D placements (orientation + angleDeg + position + meterByPx):
//
//   source px -> world -> orthogonal projection on the host plane -> host px
//
// Meant for PARALLEL base maps (see areBaseMapsParallel): the offset along
// the host normal is dropped, so the levels of a building stack on the plan.
//
// Returns `{ a, b, c, d, e, f, scale }` — the SVG `matrix(a b c d e f)` plus
// its uniform scale (host px per source px) — or null when one of the base
// maps lacks a size or a `meterByPx`.

function getSize(baseMap) {
  return typeof baseMap?.getImageSize === "function"
    ? baseMap.getImageSize()
    : baseMap?.image?.imageSize;
}

export function baseMapMatrixToSvg(m) {
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

export function applyBaseMapMatrix(m, p) {
  return {
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f,
  };
}

export default function getBaseMapToBaseMapPxMatrix(source, host) {
  const sourceSize = getSize(source);
  const hostSize = getSize(host);
  if (!sourceSize?.width || !sourceSize?.height) return null;
  if (!hostSize?.width || !hostSize?.height) return null;

  // source normalized point -> host px
  const project = (rel) => {
    const world = baseMapNormalizedToWorld(rel, source);
    if (!world) return null;
    const onHost = worldToBaseMapNormalized(world, host);
    if (!onHost) return null;
    return { x: onHost.x * hostSize.width, y: onHost.y * hostSize.height };
  };

  const origin = project({ x: 0, y: 0 });
  const right = project({ x: 1, y: 0 });
  const down = project({ x: 0, y: 1 });
  if (!origin || !right || !down) return null;

  const a = (right.x - origin.x) / sourceSize.width;
  const b = (right.y - origin.y) / sourceSize.width;
  const c = (down.x - origin.x) / sourceSize.height;
  const d = (down.y - origin.y) / sourceSize.height;
  const scale = Math.sqrt(Math.abs(a * d - b * c));
  if (!(scale > 0) || !Number.isFinite(scale)) return null;

  return { a, b, c, d, e: origin.x, f: origin.y, scale };
}

// Bounding box, in SOURCE px, of a rectangle given in HOST px (used to cull
// the overlaid annotations against the editor's visible box).
export function getSourceBoxFromHostBox(m, box) {
  const det = m.a * m.d - m.b * m.c;
  if (!det) return null;
  const invert = (p) => {
    const x = p.x - m.e;
    const y = p.y - m.f;
    return { x: (m.d * x - m.c * y) / det, y: (m.a * y - m.b * x) / det };
  };
  const corners = [
    invert({ x: box.x, y: box.y }),
    invert({ x: box.x + box.width, y: box.y }),
    invert({ x: box.x, y: box.y + box.height }),
    invert({ x: box.x + box.width, y: box.y + box.height }),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
