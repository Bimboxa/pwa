import { nanoid } from "nanoid";

import db from "App/db/db";

import isWholeResourceRel from "../utils/isWholeResourceRel";

// Links a WHOLE resource (any type: image, plan PDF, DWG...) to a business
// object: a db.relsBusinessObjectResource row without zone (no rects, no
// page). One live whole link per (business object, resource): an existing
// one is returned as is, and a whole link orphaned by a re-import of the
// resource (same name, resource gone) is re-pointed instead of duplicated.
export default async function linkResourceToBusinessObjectService({
  businessObject,
  resource,
}) {
  if (!businessObject?.id || !resource?.id) return null;

  return db.transaction(
    "rw",
    db.relsBusinessObjectResource,
    db.resources,
    async () => {
      const wholeRels = (
        await db.relsBusinessObjectResource
          .where("businessObjectId")
          .equals(businessObject.id)
          .toArray()
      ).filter((r) => !r.deletedAt && isWholeResourceRel(r));

      const existing = wholeRels.find((r) => r.resourceId === resource.id);
      if (existing) return existing;

      for (const rel of wholeRels) {
        if (rel.resourceName !== resource.name) continue;
        const own = rel.resourceId
          ? await db.resources.get(rel.resourceId)
          : null;
        if (own && !own.deletedAt) continue;
        await db.relsBusinessObjectResource.update(rel.id, {
          resourceId: resource.id,
        });
        return { ...rel, resourceId: resource.id };
      }

      const rel = {
        id: nanoid(),
        projectId: businessObject.projectId,
        scopeId: businessObject.scopeId,
        listingId: businessObject.listingId,
        businessObjectId: businessObject.id,
        resourceId: resource.id,
        resourceName: resource.name,
        pageNumber: null,
        rects: [],
        text: "",
      };
      await db.relsBusinessObjectResource.add(rel);
      return rel;
    }
  );
}
