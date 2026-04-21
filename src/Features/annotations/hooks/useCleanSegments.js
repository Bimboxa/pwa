import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useDeleteAnnotations from "./useDeleteAnnotations";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

import cleanSegments from "../utils/cleanSegments";

// Builds the static (non-points) part of a 2-point POLYLINE annotation that
// will be created from one consecutive point pair of an existing multi-point
// polyline. Copies the visual / template-related fields so the segment renders
// identically. Does NOT copy entity-specific fields (entityId, label, num) —
// the original annotation is being destructured into independent segments.
function buildSplitSegmentSkeleton(parent) {
  return {
    id: nanoid(),
    type: "POLYLINE",
    annotationTemplateId: parent.annotationTemplateId,
    annotationTemplateProps: parent.annotationTemplateProps,
    listingId: parent.listingId,
    projectId: parent.projectId,
    baseMapId: parent.baseMapId,
    strokeColor: parent.strokeColor,
    strokeWidth: parent.strokeWidth,
    strokeWidthUnit: parent.strokeWidthUnit,
    strokeOpacity: parent.strokeOpacity,
    strokeType: parent.strokeType,
    strokeOffset: parent.strokeOffset,
    overrideFields: parent.overrideFields,
    ...(parent.layerId ? { layerId: parent.layerId } : {}),
    ...(parent.hidden !== undefined ? { hidden: parent.hidden } : {}),
    ...(parent.isForBaseMaps !== undefined
      ? { isForBaseMaps: parent.isForBaseMaps }
      : {}),
  };
}

export default function useCleanSegments() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const deleteAnnotations = useDeleteAnnotations();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async (annotations) => {
    if (!annotations || annotations.length === 0) {
      return {
        splitCount: 0,
        addedCount: 0,
        updatedCount: 0,
        deletedCount: 0,
      };
    }

    const polylines = annotations.filter(
      (a) =>
        a?.type === "POLYLINE" &&
        Array.isArray(a.points) &&
        a.points.length >= 2
    );

    if (polylines.length === 0) {
      return {
        splitCount: 0,
        addedCount: 0,
        updatedCount: 0,
        deletedCount: 0,
      };
    }

    // Image size — used to convert pixel coords back to normalized [0..1]
    // before storage. Match useAnnotationsV2's order: method first, then prop.
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    const width = imageSize?.width || 1;
    const height = imageSize?.height || 1;

    // Phase 1 — split multi-point polylines into 2-point virtual segments.
    //
    // For 2-point existing polylines: pass the input annotation reference
    // directly into the algo. The algo will return updates referencing its id.
    //
    // For multi-point polylines: create one "virtual" segment per consecutive
    // point pair. We tag virtual segments with `originAnnotationId` so step 3
    // of the algo doesn't snap two pieces of the same parent onto each other.
    // We track the parent's "skeleton" so we can build fresh annotations later
    // for whichever pieces survive cleaning.
    const segmentsForAlgo = [];
    const virtualSegmentParents = new Map(); // virtualId -> parent (input poly)
    const polylinesToSplit = []; // multi-point originals to delete

    for (const a of polylines) {
      if (a.points.length === 2) {
        segmentsForAlgo.push(a);
      } else {
        polylinesToSplit.push(a.id);
        for (let i = 0; i < a.points.length - 1; i++) {
          const virtualId = nanoid();
          virtualSegmentParents.set(virtualId, a);
          segmentsForAlgo.push({
            id: virtualId,
            type: "POLYLINE",
            strokeWidth: a.strokeWidth,
            strokeWidthUnit: a.strokeWidthUnit,
            originAnnotationId: a.id,
            points: [
              {
                id: a.points[i].id,
                x: a.points[i].x,
                y: a.points[i].y,
                type: a.points[i].type,
              },
              {
                id: a.points[i + 1].id,
                x: a.points[i + 1].x,
                y: a.points[i + 1].y,
                type: a.points[i + 1].type,
              },
            ],
          });
        }
      }
    }

    // Phase 2 — clean.
    const meterByPx = baseMap?.meterByPx;
    const { updates, deleteIds } = cleanSegments({
      segments: segmentsForAlgo,
      meterByPx,
    });

    // Phase 3 — build the persistence payload.
    //
    // The DB layer stores point coordinates in db.points (normalized to
    // [0..1] against imageSize). The annotation's `points` field is just
    // an array of `{id}` references (see useSplitAnnotationsInSegments
    // and resolvePoints). Storing inline x/y on the annotation when an
    // entry exists in db.points has NO EFFECT — pointsIndex wins over
    // inline values in resolvePoints, which is why our previous attempt
    // appeared to be silently ignored.
    //
    // Strategy: for every algo-output point, mint a fresh point id
    // (deduplicated against algo-id so step-4 unification is preserved)
    // and queue a fresh `db.points` entry with normalized coords. Then:
    //   - existing 2-pt annotations get an UPDATE that swaps `points`
    //     to the new [{id}] references.
    //   - surviving virtual segments become FRESH annotations carrying
    //     the same [{id}] references.
    //
    // We never modify or delete existing db.points entries — old IDs
    // become orphans (harmless: they'll be unreferenced by the now-deleted
    // annotations). This avoids side-effects on annotations OUTSIDE our
    // selection that may share point IDs (legacy data).
    const algoIdToNewId = new Map();
    const pointsToBulkAdd = [];

    function makeRefs(pxPoints, parentBaseMapId, parentProjectId) {
      return pxPoints.map((p) => {
        let newId = algoIdToNewId.get(p.id);
        if (!newId) {
          newId = nanoid();
          algoIdToNewId.set(p.id, newId);
          pointsToBulkAdd.push({
            id: newId,
            x: p.x / width,
            y: p.y / height,
            projectId: parentProjectId,
            baseMapId: parentBaseMapId,
          });
        }
        return { id: newId, ...(p.type ? { type: p.type } : {}) };
      });
    }

    // Route algo updates between existing 2-pt polylines and virtual
    // (not-yet-persisted) segments coming from split.
    const annotationsToUpdate = []; // { id, points: [{id, type}] }
    const annotationsToBulkAdd = []; // fresh full annotations
    const survivingVirtualIds = new Set();

    for (const u of updates) {
      const parentPoly = virtualSegmentParents.get(u.id);
      if (parentPoly) {
        // This update belongs to a virtual segment — carry it via fresh add.
        survivingVirtualIds.add(u.id);
        annotationsToBulkAdd.push({
          ...buildSplitSegmentSkeleton(parentPoly),
          points: makeRefs(
            u.points,
            parentPoly.baseMapId,
            parentPoly.projectId ?? projectId
          ),
        });
      } else {
        // Existing 2-pt polyline — update its points to fresh refs.
        const existing = polylines.find((p) => p.id === u.id);
        annotationsToUpdate.push({
          id: u.id,
          points: makeRefs(
            u.points,
            existing?.baseMapId ?? polylines[0].baseMapId,
            existing?.projectId ?? polylines[0].projectId ?? projectId
          ),
        });
      }
    }

    // Virtual segments that the algo did NOT produce updates for must also
    // be persisted as-is (the algo treats them as "alive but unchanged",
    // which means it didn't include them in `updates`). They still need to
    // become real annotations because their parent will be deleted.
    const algoDeletedSet = new Set(deleteIds);
    for (const [virtualId, parentPoly] of virtualSegmentParents) {
      if (survivingVirtualIds.has(virtualId)) continue;
      if (algoDeletedSet.has(virtualId)) continue;
      // Find this virtual segment's original points
      const virtual = segmentsForAlgo.find((s) => s.id === virtualId);
      if (!virtual) continue;
      annotationsToBulkAdd.push({
        ...buildSplitSegmentSkeleton(parentPoly),
        points: makeRefs(
          virtual.points,
          parentPoly.baseMapId,
          parentPoly.projectId ?? projectId
        ),
      });
    }

    // Annotations to delete: cleanSegments-flagged real annotations + every
    // multi-point polyline we split.
    const realDeleteIds = deleteIds.filter(
      (id) => !virtualSegmentParents.has(id)
    );
    const allDeleteIds = [...polylinesToSplit, ...realDeleteIds];

    // Phase 4 — persist atomically.
    // Order: insert new points → insert new annotations → update existing
    // annotations → delete obsolete annotations. Wrap in a single Dexie
    // transaction so a failure rolls everything back.
    await db.transaction("rw", [db.annotations, db.points], async () => {
      if (pointsToBulkAdd.length > 0) {
        await db.points.bulkAdd(pointsToBulkAdd);
      }
      if (annotationsToBulkAdd.length > 0) {
        await db.annotations.bulkAdd(annotationsToBulkAdd);
      }
      if (annotationsToUpdate.length > 0) {
        await Promise.all(
          annotationsToUpdate.map((u) =>
            db.annotations.update(u.id, { points: u.points })
          )
        );
      }
    });

    // Soft-delete obsolete annotations OUTSIDE the transaction above —
    // useDeleteAnnotations runs its own transaction with extra tables
    // (cuts cleanup, listing sortedAnnotationIds sync) which we can't
    // safely nest.
    if (allDeleteIds.length > 0) {
      await deleteAnnotations(allDeleteIds);
    }

    dispatch(triggerAnnotationsUpdate());

    return {
      splitCount: polylinesToSplit.length,
      addedCount: annotationsToBulkAdd.length,
      updatedCount: annotationsToUpdate.length,
      deletedCount: allDeleteIds.length,
    };
  };
}
