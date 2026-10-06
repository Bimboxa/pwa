export const formatMesh3dQty = (value, decimals = 2) =>
  Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export function getMesh3dFaceOrientationLabel(orientation) {
  if (orientation.kind === "PARALLEL") return "Parallèle au plan";
  if (orientation.kind === "PERPENDICULAR") return "Perpendiculaire au plan";
  return `Inclinée (${formatMesh3dQty(orientation.angleDeg, 1)}°)`;
}

const plural = (count, one, many) => (count > 1 ? `${count} ${many}` : one);

// Wording + totals of the selected faces / edges of a mesh annotation
// (getMesh3dPartsInfo output), shared by the properties panel and the edit
// toolbar. isClosed (default true): false when the parts sit on an OPEN
// displayed mesh (a PX polyline wall), which no write can convert — the
// deletion is then disabled instead of failing.
export default function getMesh3dPartsDisplay({
  faces,
  edges,
  isClosed = true,
}) {
  const title = [
    faces.length ? plural(faces.length, "Face", "faces") : null,
    edges.length ? plural(edges.length, "Arête", "arêtes") : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Faces win over edges when both are selected (same rule as the service).
  const deletesFaces = faces.length > 0;
  const canDelete =
    isClosed && (deletesFaces || edges.some((edge) => edge.canMerge));
  const deleteLabel = !isClosed
    ? "Suppression impossible sur une surface ouverte"
    : deletesFaces
      ? faces.length > 1
        ? `Supprimer les ${faces.length} faces`
        : "Supprimer la face"
      : edges.length > 1
        ? `Supprimer les ${edges.length} arêtes`
        : "Supprimer l'arête";

  const totalSurface = faces.reduce((sum, face) => sum + face.area, 0);
  const totalLength = edges.reduce((sum, edge) => sum + edge.length, 0);

  return {
    title,
    deletesFaces,
    canDelete,
    deleteLabel,
    totalSurface,
    totalLength,
  };
}
