import { useDispatch, useSelector } from "react-redux";

import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  setSelectedBusinessObjectId,
  setLinkingBusinessObjectId,
} from "../businessObjectsSlice";

import db from "App/db/db";

import { getBusinessObjectDescendants } from "../utils/buildBusinessObjectsTree";

export default function useDeleteBusinessObject() {
  const dispatch = useDispatch();

  const selectedBusinessObjectId = useSelector(
    (s) => s.businessObjects.selectedBusinessObjectId
  );
  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
  );

  // Deletes a business object with its descendants and the rels pointing at
  // any deleted object. Linked annotations are NOT deleted (they belong to
  // their own listings).
  const deleteBusinessObject = async (businessObject) => {
    const listingObjects = (
      await db.businessObjects
        .where("listingId")
        .equals(businessObject.listingId)
        .toArray()
    ).filter((o) => !o.deletedAt);

    const objectsToDelete = [
      businessObject,
      ...getBusinessObjectDescendants(listingObjects, businessObject.id),
    ];
    const objectIds = objectsToDelete.map((o) => o.id);
    const objectIdsSet = new Set(objectIds);

    await db.transaction(
      "rw",
      db.businessObjects,
      db.relsBusinessObjectAnnotation,
      async () => {
        await db.businessObjects.bulkDelete(objectIds);
        const rels = await db.relsBusinessObjectAnnotation
          .where("businessObjectId")
          .anyOf(objectIds)
          .toArray();
        const relIds = rels.filter((r) => !r.deletedAt).map((r) => r.id);
        if (relIds.length > 0)
          await db.relsBusinessObjectAnnotation.bulkDelete(relIds);
      }
    );

    if (objectIdsSet.has(selectedBusinessObjectId))
      dispatch(setSelectedBusinessObjectId(null));
    if (objectIdsSet.has(linkingBusinessObjectId))
      dispatch(setLinkingBusinessObjectId(null));
    dispatch(triggerBusinessObjectsUpdate());
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  };

  return deleteBusinessObject;
}
