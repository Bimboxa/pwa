// User-facing reason (French UI string) of a refused part deletion
// (deleteMesh3dPartsService result), or null when it went through.
export default function getMesh3dPartsDeleteMessage(result) {
  if (!result || result.ok) return null;
  switch (result.reason) {
    case "LAST_FACE":
      return "C'est la dernière face : supprimez l'annotation.";
    case "EDGE_NOT_MERGEABLE":
      return "Cette arête sépare deux plans : elle ne peut pas être supprimée.";
    default:
      return "Suppression impossible.";
  }
}
