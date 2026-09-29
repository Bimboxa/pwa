import db from "App/db/db";

import buildBusinessObjectsTree, {
  getBusinessObjectsTreeDisplayMeta,
} from "../utils/buildBusinessObjectsTree";

// "Renuméroter": writes the hierarchical numbering of the tree (1, 1.1,
// 1.2, 2...) into the `code` of every object of the listing, in one
// transaction. Only the rows whose code changes are written.
// => number of updated objects
export default async function renumberBusinessObjectsService({ listingId }) {
  if (!listingId) return 0;

  return db.transaction("rw", db.businessObjects, async () => {
    const businessObjects = (
      await db.businessObjects.where("listingId").equals(listingId).toArray()
    ).filter((o) => !o.deletedAt);

    const flatTree = buildBusinessObjectsTree(businessObjects);
    const metas = getBusinessObjectsTreeDisplayMeta(flatTree);

    const updates = [];
    flatTree.forEach(({ businessObject }, i) => {
      const code = metas[i].number;
      if (businessObject.code !== code)
        updates.push({ key: businessObject.id, changes: { code } });
    });

    if (updates.length > 0) await db.businessObjects.bulkUpdate(updates);
    return updates.length;
  });
}
