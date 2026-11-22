// Edges of the holes its subtraction targets open in a FLAT polygon
// (`annotation._subtractionHoles`, read-time rings in pixels — see
// getFlatHostSubtractionHoles). They belong to the host's outline (counted
// in its length) and are selectable like its segments, but never editable:
// their geometry is the subtracted annotation's.
//
// Part id: "{annotationId}::HOLE_SEG::{holeIdx}::{segIdx}".
export const HOLE_SEG_PART_TYPE = "HOLE_SEG";

export const getHoleSegPartId = (annotationId, holeIdx, segIdx) =>
  `${annotationId}::${HOLE_SEG_PART_TYPE}::${holeIdx}::${segIdx}`;

export const isHoleSegPartId = (partId) =>
  typeof partId === "string" && partId.split("::")[1] === HOLE_SEG_PART_TYPE;

/**
 * @param {Object} annotation resolved annotation
 * @returns {Array<{partId: string, holeIdx: number, segIdx: number,
 *   p0: {x: number, y: number}, p1: {x: number, y: number}}>}
 */
export function getSubtractionHoleSegments(annotation) {
  const out = [];
  (annotation?._subtractionHoles ?? []).forEach((ring, holeIdx) => {
    if (!Array.isArray(ring) || ring.length < 3) return;
    ring.forEach((p0, segIdx) => {
      out.push({
        partId: getHoleSegPartId(annotation.id, holeIdx, segIdx),
        holeIdx,
        segIdx,
        p0,
        p1: ring[(segIdx + 1) % ring.length],
      });
    });
  });
  return out;
}

// The selected hole segments of an annotation, from a list of part ids.
export function getSelectedHoleSegments(annotation, partIds) {
  const selected = new Set((partIds ?? []).filter(isHoleSegPartId));
  if (selected.size === 0) return [];
  return getSubtractionHoleSegments(annotation).filter((s) =>
    selected.has(s.partId)
  );
}
