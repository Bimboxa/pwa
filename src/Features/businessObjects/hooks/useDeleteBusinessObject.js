import { useDispatch, useSelector } from "react-redux";

import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  setActiveBusinessObjectId,
  setSoloBusinessObjectId,
  setLinkingBusinessObjectId,
} from "../businessObjectsSlice";
import { clearSelection } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";

import { getBusinessObjectDescendants } from "../utils/buildBusinessObjectsTree";
import selectSelectedBusinessObjectId from "../utils/selectSelectedBusinessObjectId";
import getMainRelsOfBusinessObjectsService from "../services/getMainRelsOfBusinessObjectsService";

export default function useDeleteBusinessObject() {
  const dispatch = useDispatch();

  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const soloBusinessObjectId = useSelector(
    (s) => s.businessObjects.soloBusinessObjectId
  );
  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
  );

  const deleteAnnotations = useDeleteAnnotations();

  // Deletes a business object with its descendants and the rels pointing at
  // any deleted object. Plain linked annotations are NOT deleted (they belong
  // to their own listings); the objects' MAIN annotations (drawn by
  // "Localiser", owned by the object) are — best effort, outside the object
  // transaction, so an ownership error on a foreign annotation never rolls
  // back the object deletion.
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

    const mainAnnotationIds = (
      await getMainRelsOfBusinessObjectsService(objectIds)
    ).map((r) => r.annotationId);

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

    if (mainAnnotationIds.length > 0) {
      try {
        await deleteAnnotations(mainAnnotationIds);
      } catch (e) {
        console.error("[useDeleteBusinessObject] main annotations", e);
        dispatch(
          setToaster({
            message:
              "Ouvrage supprimé, mais certaines annotations de localisation n'ont pas pu l'être.",
            isError: true,
          })
        );
      }
    }

    // a deleted object can't stay selected / active / soloed / armed: the
    // module's default selection effect falls back to the listing.
    if (objectIdsSet.has(selectedBusinessObjectId)) dispatch(clearSelection());
    if (objectIdsSet.has(activeBusinessObjectId))
      dispatch(setActiveBusinessObjectId(null));
    if (objectIdsSet.has(soloBusinessObjectId))
      dispatch(setSoloBusinessObjectId(null));
    if (objectIdsSet.has(linkingBusinessObjectId))
      dispatch(setLinkingBusinessObjectId(null));
    dispatch(triggerBusinessObjectsUpdate());
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  };

  return deleteBusinessObject;
}
