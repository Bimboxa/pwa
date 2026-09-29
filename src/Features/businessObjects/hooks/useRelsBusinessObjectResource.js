import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live rows of db.relsBusinessObjectResource (document highlights linked to
// business objects), by business object, resource or listing.
// By resource: pass `resource` to also get the rows that lost their
// resourceId (resource deleted then re-imported) and match by name.
export default function useRelsBusinessObjectResource({
  businessObjectId,
  resource,
  listingId,
} = {}) {
  const resourceId = resource?.id;
  const resourceName = resource?.name;
  const projectId = resource?.projectId;

  // trigger

  const relsResourceUpdatedAt = useSelector(
    (s) => s.businessObjects.relsResourceUpdatedAt
  );

  // main

  const rels = useLiveQuery(async () => {
    let collection;
    if (businessObjectId) {
      collection = db.relsBusinessObjectResource
        .where("businessObjectId")
        .equals(businessObjectId);
    } else if (resourceId) {
      const rows = (
        await db.relsBusinessObjectResource
          .where("resourceId")
          .equals(resourceId)
          .toArray()
      ).filter((r) => !r.deletedAt);
      if (!resourceName || !projectId) return rows;
      const orphans = [];
      const sameName = (
        await db.relsBusinessObjectResource
          .where("projectId")
          .equals(projectId)
          .toArray()
      ).filter(
        (r) =>
          !r.deletedAt &&
          r.resourceId !== resourceId &&
          r.resourceName === resourceName
      );
      for (const rel of sameName) {
        const own = rel.resourceId
          ? await db.resources.get(rel.resourceId)
          : null;
        if (!own || own.deletedAt) orphans.push(rel);
      }
      return [...rows, ...orphans];
    } else if (listingId) {
      collection = db.relsBusinessObjectResource
        .where("listingId")
        .equals(listingId);
    } else {
      return [];
    }
    const rows = await collection.toArray();
    return rows.filter((r) => !r.deletedAt);
  }, [
    businessObjectId,
    resourceId,
    resourceName,
    projectId,
    listingId,
    relsResourceUpdatedAt,
  ]);

  return { value: rels, loading: rels === undefined };
}
