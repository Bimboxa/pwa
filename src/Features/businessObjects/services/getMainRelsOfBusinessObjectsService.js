import db from "App/db/db";

// Live rels flagged isMain (main annotation per base map) of the given
// business objects. isMain is not indexable: filtered in memory after the
// businessObjectId index lookup.
export default async function getMainRelsOfBusinessObjectsService(
  businessObjectIds
) {
  if (!businessObjectIds?.length) return [];
  const rels = await db.relsBusinessObjectAnnotation
    .where("businessObjectId")
    .anyOf(businessObjectIds)
    .toArray();
  return rels.filter((r) => !r.deletedAt && r.isMain);
}
