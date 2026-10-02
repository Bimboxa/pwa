// Part ids of an annotation mesh, in the selection slice's part-id convention
// ("{annotationId}::{partType}::{key}", like the 2D "SEG" parts):
//
//   {annotationId}::MESH3D_FACE::{faceIndex}
//   {annotationId}::MESH3D_EDGE::{a}_{b}     (vertex indices, a < b)
//
// A selected face / edge is a sub-selection of its annotation: the annotation
// stays selectedItems[0], the part sits in its partId / partType (and in
// selectedPartIds for a multi selection).
//
// Indices address the stored mesh AS IT IS: every mesh write renumbers faces
// and vertices, so the part selection is cleared after each edit (a line
// drawn on a selected face re-selects one of the pieces it split it into).

export const MESH3D_FACE_PART = "MESH3D_FACE";
export const MESH3D_EDGE_PART = "MESH3D_EDGE";

export function getMesh3dFacePartId(annotationId, faceIndex) {
  return `${annotationId}::${MESH3D_FACE_PART}::${faceIndex}`;
}

export function getMesh3dEdgePartId(annotationId, a, b) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${annotationId}::${MESH3D_EDGE_PART}::${lo}_${hi}`;
}

// { annotationId, partType, faceIndex } | { annotationId, partType, a, b }
// | null when the id is not a mesh part.
export function parseMesh3dPartId(partId) {
  if (typeof partId !== "string") return null;
  const [annotationId, partType, key] = partId.split("::");
  if (!annotationId || key === undefined) return null;
  if (partType === MESH3D_FACE_PART) {
    const faceIndex = Number(key);
    return Number.isInteger(faceIndex)
      ? { annotationId, partType, faceIndex }
      : null;
  }
  if (partType === MESH3D_EDGE_PART) {
    const [a, b] = key.split("_").map(Number);
    return Number.isInteger(a) && Number.isInteger(b)
      ? { annotationId, partType, a, b }
      : null;
  }
  return null;
}

export const isMesh3dPartId = (partId) => parseMesh3dPartId(partId) !== null;

// Mesh parts of the current selection: the multi array when it holds some,
// else the single sub-selected part. Parts of another annotation than the
// selected one are dropped.
export function getSelectedMesh3dParts(selectedItem, selectedPartIds) {
  if (selectedItem?.type !== "NODE") return [];
  const ids = selectedPartIds?.length
    ? selectedPartIds
    : selectedItem.partId
      ? [selectedItem.partId]
      : [];
  return ids
    .map(parseMesh3dPartId)
    .filter((part) => part && part.annotationId === selectedItem.nodeId);
}

// True when face `faceIndex` of annotation `annotationId` is a selected part.
export function isMesh3dFaceSelected(
  selectedItem,
  selectedPartIds,
  annotationId,
  faceIndex
) {
  return getSelectedMesh3dParts(selectedItem, selectedPartIds).some(
    (part) =>
      part.partType === MESH3D_FACE_PART &&
      part.annotationId === annotationId &&
      part.faceIndex === faceIndex
  );
}
