// Part ids of the FACES of a surface host (lathe, shell, swept profile —
// applySurfaceCuts tags its SOLID meshes as pieces), in the selection
// slice's part-id convention ("{annotationId}::{partType}::{key}", like the
// mesh parts of annotationMesh3d):
//
//   {annotationId}::SURFACE_PIECE::{pieceIndex}:{seedTri}
//
// pieceIndex = userData.surfaceCutPiece of the displayed piece mesh; seedTri
// = a triangle of that mesh whose face region (getFaceRegion with the face
// selection angle — the same region the hover stipples: the facets joined
// within the dihedral tolerance, so a smooth band of a lathe or a shell, not
// the whole mesh) is the selected face. The seed is the region's own id (its
// min triangle index) so one face has one id; a plane-mode region (carved
// host) keeps the hit triangle. Without seedTri the part is the whole piece.
//
// Every SOLID mesh of a surface host is a piece from the first build (an
// uncut lathe is piece 0), numbered by planSurfacePieces: deterministic
// between two identical builds, but renumbered by every rebuild that changes
// the pieces — and the regions move with the geometry and the angle —, so a
// selection only holds for the displayed object (useSurfacePiecesHighlight
// drops it when the face is gone).
//
// Pure: node-testable.

export const SURFACE_PIECE_PART = "SURFACE_PIECE";

export function getSurfacePiecePartId(annotationId, pieceIndex, seedTri) {
  const key = Number.isInteger(seedTri)
    ? `${pieceIndex}:${seedTri}`
    : `${pieceIndex}`;
  return `${annotationId}::${SURFACE_PIECE_PART}::${key}`;
}

// { annotationId, partType, pieceIndex, seedTri } | null when not a piece
// part. seedTri is null for a whole-piece part.
export function parseSurfacePiecePartId(partId) {
  if (typeof partId !== "string") return null;
  const [annotationId, partType, key] = partId.split("::");
  if (!annotationId || partType !== SURFACE_PIECE_PART || !key) return null;
  const [pieceKey, seedKey] = key.split(":");
  const pieceIndex = Number(pieceKey);
  if (!Number.isInteger(pieceIndex)) return null;
  const seedTri = seedKey === undefined ? null : Number(seedKey);
  if (seedTri !== null && !Number.isInteger(seedTri)) return null;
  return { annotationId, partType, pieceIndex, seedTri };
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
