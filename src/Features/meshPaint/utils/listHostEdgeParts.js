// Every paintable EDGE part of ONE host (buildHostPartIndex), as the
// « Pinceau » picks them one click at a time (meshBrushPick's edgeTarget) —
// the parts of « Peindre toutes les arêtes de l'annotation »:
//
// - one part per curve of index.getCurves(smoothAngleDeg): a straight
//   feature edge (2 points), or the planar curve neighboring edges make
//   while they turn by less than the « Sélection de face » angle (more
//   points; closed: first point repeated) — which then remembers that angle;
// - each with the normals of the facets it borders (`sides`).
//
// Pure: node-testable, no imports.

/**
 * @param {object} index - buildHostPartIndex result
 * @param {object} [options]
 * @param {number} [options.smoothAngleDeg] - « Sélection de face » angle
 * @param {number} [options.maxParts] - above this many parts nothing is
 *   listed (`tooMany`)
 * @returns {{parts: object[], tooMany: boolean}} parts: LocalEdges
 */
export default function listHostEdgeParts(
  index,
  { smoothAngleDeg = 0, maxParts = Infinity } = {}
) {
  const angle = Math.max(0, Number(smoothAngleDeg) || 0);
  const curves = index?.getCurves?.(angle)?.curves ?? [];
  if (curves.length > maxParts) return { parts: [], tooMany: true };
  const parts = curves.map((curve) => {
    const edge = { points: [...curve.points] };
    if (curve.sides?.length) edge.sides = curve.sides;
    if (curve.points.length > 2) edge.angleDeg = angle;
    return edge;
  });
  return { parts, tooMany: false };
}
