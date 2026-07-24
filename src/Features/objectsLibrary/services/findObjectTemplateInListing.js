import db from "App/db/db";

// Find a non-deleted annotationTemplate in the listing that was created from the
// same library model (matching modelIdMaster). Returns the template or null.
export default async function findObjectTemplateInListing(
  listingId,
  modelIdMaster
) {
  if (!listingId || !modelIdMaster) return null;
  const templates = await db.annotationTemplates
    .where("listingId")
    .equals(listingId)
    .toArray();
  return (
    templates.find((t) => !t.deletedAt && t.modelIdMaster === modelIdMaster) ??
    null
  );
}
