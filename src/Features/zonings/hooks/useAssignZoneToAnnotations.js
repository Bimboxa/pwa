import { useRef } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerRelsZoneAnnotationUpdate } from "../zoningsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import db from "App/db/db";
import splitAnnotationsByContourService from "Features/annotations/services/splitAnnotationsByContourService";

// "Affecter la zone": from a selected zone delimitation polygon, links every
// annotation lying inside it to the zone (relsZoneAnnotation), splitting the
// POLYGON / POLYLINE / STRIP annotations crossed by the zone perimeter so that
// only the inner part gets linked (geometry:
// annotations/services/splitAnnotationsByContourService).
export default function useAssignZoneToAnnotations() {
  const dispatch = useDispatch();

  // data — same filter set as useVisibleAnnotations, but solo-proof so an
  // active zone SOLO doesn't shrink the candidate set.
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const annotations = useAnnotationsV2({
    caller: "useAssignZoneToAnnotations",
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
    ignoreSolo: true,
  });
  const baseMap = useMainBaseMap();

  const runningRef = useRef(false);

  function toastResult(result) {
    if (!result) return;
    if (result.noPolygon) {
      dispatch(
        setToaster({
          message: "Dessinez d'abord le polygone de délimitation de la zone",
          severity: "warning",
        })
      );
      return;
    }
    dispatch(
      setToaster({
        message: `${result.linked} annotation(s) liée(s) à la zone, ${result.split} découpée(s)`,
        severity: "success",
      })
    );
  }

  async function assignZone(zoneAnnotation) {
    if (runningRef.current) return null;
    runningRef.current = true;
    try {
      const result = await run(zoneAnnotation);
      toastResult(result);
      return result;
    } finally {
      runningRef.current = false;
    }
  }

  // "Affecter la zone" from the zone itself (tree menu, zone properties
  // panel): runs the pipeline on every delimitation polygon drawn for the
  // zone. Later polygons skip annotations already rewritten by an earlier
  // one — `annotations` is a single resolved snapshot, so re-cutting them
  // would resurrect their pre-cut geometry.
  async function assignZoneForZone(zone) {
    if (runningRef.current || !zone?.templateId) return null;
    const zonePolygons = (annotations ?? []).filter(
      (a) =>
        a?.isZoneAnnotation &&
        a.type === "POLYGON" &&
        a.annotationTemplateId === zone.templateId
    );
    if (zonePolygons.length === 0) {
      const result = { noPolygon: true };
      toastResult(result);
      return result;
    }
    runningRef.current = true;
    try {
      let linked = 0;
      let split = 0;
      const touchedIds = new Set();
      for (const zoneAnnotation of zonePolygons) {
        const result = await run(zoneAnnotation, touchedIds);
        if (!result) continue;
        linked += result.linked;
        split += result.split;
        (result.touchedIds ?? []).forEach((id) => touchedIds.add(id));
      }
      const result = { linked, split, polygons: zonePolygons.length };
      toastResult(result);
      return result;
    } finally {
      runningRef.current = false;
    }
  }

  async function run(zoneAnnotation, excludeIds) {
    if (
      !zoneAnnotation?.isZoneAnnotation ||
      zoneAnnotation.type !== "POLYGON" ||
      (zoneAnnotation.points?.length ?? 0) < 3
    )
      return null;

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize?.width || !imageSize?.height) return null;

    // zone → template → zone row
    const template = zoneAnnotation.annotationTemplateId
      ? await db.annotationTemplates.get(zoneAnnotation.annotationTemplateId)
      : null;
    const zone = template?.zoneId ? await db.zones.get(template.zoneId) : null;
    if (!zone || zone.deletedAt) return null;

    const {
      pointsToSave,
      annotationUpdates,
      newAnnotationRows,
      newMappingRels,
      linkedAnnotationIds: uniqueLinkIds,
      splitCount,
    } = await splitAnnotationsByContourService({
      contourAnnotation: zoneAnnotation,
      annotations: (annotations ?? []).filter(
        (a) =>
          a &&
          !excludeIds?.has(a.id) &&
          !a.isZoneAnnotation &&
          !a.isBaseMapAnnotation &&
          !a.isMeshCell
      ),
      imageSize,
    });

    // zone links: replace-within-zoning rule, batched. Existing annotations
    // may already carry a rel on this zoning; new piece rows never do.
    const existingRels =
      uniqueLinkIds.length > 0
        ? (
            await db.relsZoneAnnotation
              .where("annotationId")
              .anyOf(uniqueLinkIds)
              .toArray()
          ).filter((r) => !r.deletedAt && r.listingId === zone.listingId)
        : [];
    const relIdsToDelete = existingRels
      .filter((r) => r.zoneId !== zone.id)
      .map((r) => r.id);
    const alreadyLinked = new Set(
      existingRels
        .filter((r) => r.zoneId === zone.id)
        .map((r) => r.annotationId)
    );
    const relsToAdd = uniqueLinkIds
      .filter((id) => !alreadyLinked.has(id))
      .map((annotationId) => ({
        id: nanoid(),
        projectId: zone.projectId,
        scopeId: zone.scopeId,
        annotationId,
        zoneId: zone.id,
        listingId: zone.listingId,
      }));

    if (
      pointsToSave.length === 0 &&
      annotationUpdates.length === 0 &&
      newAnnotationRows.length === 0 &&
      relIdsToDelete.length === 0 &&
      relsToAdd.length === 0
    ) {
      return {
        linked: alreadyLinked.size,
        split: 0,
        touchedIds: uniqueLinkIds,
      };
    }

    // single transaction + single dispatch wave (batch-write pattern)
    await db.transaction(
      "rw",
      [
        db.points,
        db.annotations,
        db.relAnnotationMappingCategory,
        db.relsZoneAnnotation,
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
          await db.relsZoneAnnotation.bulkDelete(relIdsToDelete);
        if (relsToAdd.length > 0)
          await db.relsZoneAnnotation.bulkAdd(relsToAdd);
      }
    );

    if (annotationUpdates.length > 0 || newAnnotationRows.length > 0)
      dispatch(triggerAnnotationsUpdate());
    dispatch(triggerRelsZoneAnnotationUpdate());

    return {
      linked: uniqueLinkIds.length,
      split: splitCount,
      touchedIds: [
        ...new Set([...annotationUpdates.map((u) => u.id), ...uniqueLinkIds]),
      ],
    };
  }

  return { assignZone, assignZoneForZone };
}
