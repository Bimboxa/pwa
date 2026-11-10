import getAnnotationBBox from "../../annotations/utils/getAnnotationBbox.js";

// Bounding box of the members of a block, in METERS in the block frame:
// origin = the block insertion point, axes = the origin base map image axes
// (y down).
//   members: annotations resolved in PIXELS on the origin base map
//   originPx: {x, y} insertion point in the same pixel frame
//   meterByPx: scale of the origin base map
// Returns {minX, minY, maxX, maxY} or null (no measurable member / no scale).
export default function getBlockBoundsM({ members, originPx, meterByPx }) {
  if (!originPx || !(meterByPx > 0)) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const member of members ?? []) {
    const bbox = getAnnotationBBox(member);
    if (
      !bbox ||
      !Number.isFinite(bbox.x) ||
      !Number.isFinite(bbox.y) ||
      !Number.isFinite(bbox.width) ||
      !Number.isFinite(bbox.height)
    )
      continue;
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }
  if (minX === Infinity) return null;
  return {
    minX: (minX - originPx.x) * meterByPx,
    minY: (minY - originPx.y) * meterByPx,
    maxX: (maxX - originPx.x) * meterByPx,
    maxY: (maxY - originPx.y) * meterByPx,
  };
}
