// Annotation types « Lier à un bloc » can move from a regular base map to a
// blocks base map (v1): the geometry families the move rebuilds entirely.
export const BLOCK_LINK_MEMBER_TYPES = ["POLYGON", "POLYLINE", "STRIP", "POINT"];

export const BLOCK_LINK_REFUSALS = {
  EMPTY: "EMPTY",
  SEVERAL_BASE_MAPS: "SEVERAL_BASE_MAPS",
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
  OPENING: "OPENING",
  MESH_CELL: "MESH_CELL",
  READ_ONLY: "READ_ONLY",
};

const MESSAGES = {
  EMPTY: "Aucune annotation à lier.",
  SEVERAL_BASE_MAPS:
    "Les annotations à lier doivent être sur le même fond de plan.",
  UNSUPPORTED_TYPE:
    "Seules les surfaces, lignes, bandes et points peuvent être liés à un bloc.",
  OPENING:
    "Une ouverture ou une annotation portant des ouvertures ne peut pas être liée à un bloc.",
  MESH_CELL: "Une maille ne peut pas être liée à un bloc.",
  READ_ONLY: "Cette annotation ne peut pas être liée à un bloc.",
};

export function getBlockLinkRefusalMessage(refusal) {
  return MESSAGES[refusal] ?? null;
}

// Why a selection (resolved annotations of a REGULAR base map) cannot be
// moved into a block, or null when it can. Checks the rows only — the
// relations (subtractions, painted parts) are checked by the service.
// Pure: node-testable.
export default function getBlockLinkRefusal(annotations) {
  const list = (annotations ?? []).filter(Boolean);
  if (list.length === 0) return BLOCK_LINK_REFUSALS.EMPTY;
  if (new Set(list.map((a) => a.baseMapId)).size > 1)
    return BLOCK_LINK_REFUSALS.SEVERAL_BASE_MAPS;
  for (const a of list) {
    if (!BLOCK_LINK_MEMBER_TYPES.includes(a.type))
      return BLOCK_LINK_REFUSALS.UNSUPPORTED_TYPE;
    if (a.isOpening || a.openings?.length > 0)
      return BLOCK_LINK_REFUSALS.OPENING;
    if (a.isMeshCell) return BLOCK_LINK_REFUSALS.MESH_CELL;
    if (a.isBaseMapAnnotation || a.isForeignFootprint || a.isScaleSegment)
      return BLOCK_LINK_REFUSALS.READ_ONLY;
  }
  return null;
}
