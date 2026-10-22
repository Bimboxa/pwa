// Part ids of the pieces of a cut surface host (applySurfaceCuts), in the
// selection slice's part-id convention ("{annotationId}::{partType}::{key}",
// like the mesh parts of annotationMesh3d):
//
//   {annotationId}::SURFACE_PIECE::{pieceIndex}
//
// pieceIndex = userData.surfaceCutPiece of the displayed piece mesh. Every
// SOLID mesh of a surface host is a piece from the first build (an uncut
// lathe is piece 0), numbered by planSurfacePieces: deterministic between
// two identical builds, but renumbered by every rebuild that changes the
// pieces, so a selection only holds for the displayed object
// (useSurfacePiecesHighlight drops it when the piece is gone).
//
// Pure: node-testable.

export const SURFACE_PIECE_PART = "SURFACE_PIECE";

export function getSurfacePiecePartId(annotationId, pieceIndex) {
  return `${annotationId}::${SURFACE_PIECE_PART}::${pieceIndex}`;
}

// { annotationId, partType, pieceIndex } | null when not a piece part.
export function parseSurfacePiecePartId(partId) {
  if (typeof partId !== "string") return null;
  const [annotationId, partType, key] = partId.split("::");
  if (!annotationId || partType !== SURFACE_PIECE_PART) return null;
  const pieceIndex = Number(key);
  return Number.isInteger(pieceIndex)
    ? { annotationId, partType, pieceIndex }
    : null;
}

export const isSurfacePiecePartId = (partId) =>
  parseSurfacePiecePartId(partId) !== null;

// Piece parts of the current selection (the multi array when it holds some,
// else the single sub-selected part), those of the selected annotation only.
export function getSelectedSurfacePieces(selectedItem, selectedPartIds) {
  if (selectedItem?.type !== "NODE") return [];
  const ids = selectedPartIds?.length
    ? selectedPartIds
    : selectedItem.partId
      ? [selectedItem.partId]
      : [];
  return ids
    .map(parseSurfacePiecePartId)
    .filter((part) => part && part.annotationId === selectedItem.nodeId);
}
