import { useRef } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import db from "App/db/db";
import splitAnnotationsByContourService from "Features/annotations/services/splitAnnotationsByContourService";
import getBusinessObjectLinkWrites from "../utils/getBusinessObjectLinkWrites";
import isSingleObjectPerAnnotationListing from "../utils/isSingleObjectPerAnnotationListing";

// "Affecter les annotations à l'intérieur" (types with the `assignByGeometry`
// feature, e.g. the locations): the MAIN POLYGON annotation of the object on
// the current base map links every annotation lying inside it to the object,
// splitting the POLYGON / POLYLINE / STRIP annotations crossed by its
// perimeter so that only the inner part gets linked (geometry:
// annotations/services/splitAnnotationsByContourService — same pipeline as
// the zonings' "Affecter la zone").
// Links follow the listing rule (utils/getBusinessObjectLinkWrites). The
// pieces created by a split inherit the plain links of their source
// annotation, so cutting a surface never drops it from its other objects.
export default function useAssignBusinessObjectToAnnotations() {
  const dispatch = useDispatch();

  // data — same filter set as useVisibleAnnotations, but solo-proof so an
  // active object SOLO doesn't shrink the candidate set.
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const annotations = useAnnotationsV2({
    caller: "useAssignBusinessObjectToAnnotations",
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
    ignoreSolo: true,
  });
  const baseMap = useMainBaseMap();

  const runningRef = useRef(false);

  function toastResult(businessObject, result) {
    if (!result) return;
    if (result.noPolygon) {
      dispatch(
        setToaster({
          message: `Dessinez d'abord le polygone de "${businessObject.label}" sur ce plan`,
          severity: "warning",
        })
      );
      return;
    }
    dispatch(
      setToaster({
        message: `${result.linked} annotation(s) liée(s) à "${businessObject.label}", ${result.split} découpée(s)`,
        severity: "success",
      })
    );
  }

  async function assignForBusinessObject(businessObject) {
    if (runningRef.current || !businessObject?.id) return null;
    runningRef.current = true;
    try {
      const result = await run(businessObject);
      toastResult(businessObject, result);
      return result;
    } finally {
      runningRef.current = false;
    }
  }

  // From the object's main annotation (toolbar of the selected polygon).
  async function assignForAnnotation(annotation) {
    const businessObject = annotation?.mainBusinessObjectId
      ? await db.businessObjects.get(annotation.mainBusinessObjectId)
      : null;
    if (!businessObject || businessObject.deletedAt) return null;
    return assignForBusinessObject(businessObject);
  }

  async function run(businessObject) {
    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize?.width || !imageSize?.height) return null;

    const listing = await db.listings.get(businessObject.listingId);
    const listingRels = (
      await db.relsBusinessObjectAnnotation
        .where("listingId")
        .equals(businessObject.listingId)
        .toArray()
    ).filter((r) => !r.deletedAt);

    // contour = the object's main POLYGON on the current base map; the main
    // annotations of the listing (the objects' own geometry) are never
    // candidates.
    const mainAnnotationIds = new Set();
    const ownMainAnnotationIds = new Set();
    listingRels.forEach((r) => {
      if (!r.isMain) return;
      mainAnnotationIds.add(r.annotationId);
      if (r.businessObjectId === businessObject.id)
        ownMainAnnotationIds.add(r.annotationId);
    });
    const contourAnnotation = (annotations ?? []).find(
      (a) =>
        a &&
        ownMainAnnotationIds.has(a.id) &&
        a.type === "POLYGON" &&
        (a.points?.length ?? 0) >= 3
    );
    if (!contourAnnotation) return { noPolygon: true };

    const {
      pointsToSave,
      annotationUpdates,
      newAnnotationRows,
      newMappingRels,
      linkedAnnotationIds,
      sourceIdByNewRowId,
      splitCount,
    } = await splitAnnotationsByContourService({
      contourAnnotation,
      annotations: (annotations ?? []).filter(
        (a) =>
          a &&
          !mainAnnotationIds.has(a.id) &&
          !a.isZoneAnnotation &&
          !a.isBaseMapAnnotation &&
          !a.isMeshCell
      ),
      imageSize,
    });

    // links of the inner annotations (listing rule)
    const linkedIdSet = new Set(linkedAnnotationIds);
    const { relsToAdd, relIdsToDelete } = getBusinessObjectLinkWrites({
      businessObject,
      annotationIds: linkedAnnotationIds,
      listingRels: listingRels.filter((r) => linkedIdSet.has(r.annotationId)),
      isExclusive: isSingleObjectPerAnnotationListing(listing),
    });
    const alreadyLinkedCount = linkedAnnotationIds.length - relsToAdd.length;

    // a cut annotation whose kept part lies outside leaves the object
    const outsideCutIds = new Set(
      annotationUpdates.map((u) => u.id).filter((id) => !linkedIdSet.has(id))
    );
    listingRels.forEach((r) => {
      if (
        outsideCutIds.has(r.annotationId) &&
        r.businessObjectId === businessObject.id &&
        !r.isMain
      )
        relIdsToDelete.push(r.id);
    });

    // split pieces inherit the plain links of their source annotation
    // (other listings; this listing only for the outer pieces, towards the
    // other objects)
    const sourceIds = [...new Set(Object.values(sourceIdByNewRowId))];
    const sourceRels =
      sourceIds.length > 0
        ? (
            await db.relsBusinessObjectAnnotation
              .where("annotationId")
              .anyOf(sourceIds)
              .toArray()
          ).filter((r) => !r.deletedAt && !r.isMain)
        : [];
    const inheritedRels = [];
    Object.entries(sourceIdByNewRowId).forEach(([pieceId, sourceId]) => {
      sourceRels.forEach((r) => {
        if (r.annotationId !== sourceId) return;
        if (
          r.listingId === businessObject.listingId &&
          (linkedIdSet.has(pieceId) || r.businessObjectId === businessObject.id)
        )
          return;
        inheritedRels.push({
          id: nanoid(),
          projectId: r.projectId,
          scopeId: r.scopeId,
          annotationId: pieceId,
          businessObjectId: r.businessObjectId,
          listingId: r.listingId,
        });
      });
    });

    const hasGeometryWrites =
      pointsToSave.length > 0 ||
      annotationUpdates.length > 0 ||
      newAnnotationRows.length > 0;
    if (
      !hasGeometryWrites &&
      relIdsToDelete.length === 0 &&
      relsToAdd.length === 0
    ) {
      return { linked: alreadyLinkedCount, split: 0 };
    }

    // single transaction + single dispatch wave (batch-write pattern)
    await db.transaction(
      "rw",
      [
        db.points,
        db.annotations,
        db.relAnnotationMappingCategory,
        db.relsBusinessObjectAnnotation,
      ],
      async () => {
        if (pointsToSave.length > 0) await db.points.bulkAdd(pointsToSave);
        for (const { id, changes } of annotationUpdates) {
          await db.annotations.update(id, changes);
        }
        if (newAnnotationRows.length > 0)
          await db.annotations.bulkAdd(newAnnotationRows);
        if (newMappingRels.length > 0)
          await db.relAnnotationMappingCategory.bulkAdd(newMappingRels);
        if (relIdsToDelete.length > 0)
          await db.relsBusinessObjectAnnotation.bulkDelete(relIdsToDelete);
        if (relsToAdd.length > 0 || inheritedRels.length > 0)
          await db.relsBusinessObjectAnnotation.bulkAdd([
            ...relsToAdd,
            ...inheritedRels,
          ]);
      }
    );

    if (hasGeometryWrites) dispatch(triggerAnnotationsUpdate());
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());

    return { linked: linkedAnnotationIds.length, split: splitCount };
  }

  return { assignForBusinessObject, assignForAnnotation };
}
