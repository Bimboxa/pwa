// Name of the mesh of an annotation in the scene.glb of « Ligne de coupe –
// prompt IA », also quoted by contexte.json (`curvedSurfaces[].mesh`):
// readable label, then the annotation id (unique).
export default function getCutLinesPromptMeshName(label, annotationId) {
  const slug = String(label ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${slug || "annotation"}__${annotationId}`;
}
