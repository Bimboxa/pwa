import db from "App/db/db";

// Resolves the resource of a relsBusinessObjectResource row. rel.resourceId
// is only a hint: after the resource is deleted and re-imported its id
// changes, so fall back to the resource name inside the project (same
// resilience as resolveDetailResource for detail base maps). The file may be
// missing locally: the viewer offers to re-attach it.
export default async function resolveResourceOfRelService(rel) {
  if (!rel) return null;

  if (rel.resourceId) {
    const resource = await db.resources.get(rel.resourceId);
    if (resource && !resource.deletedAt) return resource;
  }

  if (!rel.resourceName || !rel.projectId) return null;
  const candidates = (
    await db.resources.where("projectId").equals(rel.projectId).toArray()
  ).filter((r) => !r.deletedAt && r.name === rel.resourceName);
  return candidates[0] ?? null;
}
