import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

// Colour a painted part takes in 3D (and its brush preview): the template's
// 3D override first, then the fill (FACE: a Surface paint, like makeMaterial's
// fill-driven POLYGON branch) or the stroke (EDGE: a Ligne paint, the
// stroke-driven branch), as #rrggbb (three's Color takes no alpha).
//
// Pure: node-testable.

function normalizeHex(hex) {
  if (typeof hex !== "string") return hex;
  if (hex.length === 9 && hex.startsWith("#")) return hex.slice(0, 7);
  if (hex.length === 5 && hex.startsWith("#")) return hex.slice(0, 4);
  return hex;
}

export default function getMeshPaintColor(template, partType) {
  if (template?.color3D) return normalizeHex(template.color3D);
  const isEdge = partType === MESH_PAINT_PART_TYPES.EDGE;
  return normalizeHex(
    isEdge
      ? template?.strokeColor || template?.fillColor || "#cccccc"
      : template?.fillColor || template?.strokeColor || "#cccccc"
  );
}
