import db from "App/db/db";

// The project's annotations flagged « Profil » (annotation.isProfile, the
// Propriétés panel switch), as menu items { id, label } — label falling back
// to the template label. Shared by the Élévation « Choisir un profil » button
// and the « Ajouter un profil » toolbar menu (transient menus: fetched on
// open, no live query).
export default async function listProfileAnnotations({
  projectId,
  excludeAnnotationId,
} = {}) {
  const all = await db.annotations
    .filter(
      (a) =>
        Boolean(a.isProfile) &&
        !a.deletedAt &&
        a.id !== excludeAnnotationId &&
        (!projectId || a.projectId === projectId)
    )
    .toArray();
  const templateIds = [
    ...new Set(all.map((a) => a.annotationTemplateId).filter(Boolean)),
  ];
  const templates = templateIds.length
    ? await db.annotationTemplates.bulkGet(templateIds)
    : [];
  const templateById = new Map(templates.filter(Boolean).map((t) => [t.id, t]));
  return all.map((a) => ({
    id: a.id,
    label:
      a.label || templateById.get(a.annotationTemplateId)?.label || "Sans nom",
  }));
}
