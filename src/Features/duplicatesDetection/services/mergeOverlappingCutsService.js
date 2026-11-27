import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import collapseArcsInPolyline from "Features/geometry/utils/collapseArcsInPolyline";

import mergeCutRings from "../utils/mergeCutRings";

// Repair of the overlapping cuts found by findOverlappingCuts: every cluster
// of cuts is replaced by ONE cut, their union. The merged cut keeps the id
// and props of the cluster's first cut; the other cuts of the annotation are
// left as they are.
//
// `annotations` are the resolved ones (pixel points, useAnnotationsV2): the
// union is computed in pixel space, the new vertices (crossings of two cuts)
// go to db.points NORMALIZED, and the cut references points by id only
// (docs/annotations/POINTS_STORAGE.md). One transaction for the whole batch
// = one undo step.
//
// A cluster is skipped (left untouched, still listed by the next run) when:
//   - its union is not a single ring without a hole (mergeCutRings → null),
//   - one of its cuts is driven by something else: a cut host (`cutHostId`),
//     an opening carved as an inner ring (relAnnotationOpenings.carve.cutId),
//   - one of its cuts stores inline coordinates (legacy), or changed since
//     the run.
//
// → { mergedAnnotationIds, mergedClusters, skippedClusters }
export default async function mergeOverlappingCutsService({
  annotations,
  cutOverlaps,
  baseMap,
}) {
  const empty = {
    mergedAnnotationIds: [],
    mergedClusters: 0,
    skippedClusters: 0,
  };
  if (!cutOverlaps?.length) return empty;

  const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
  if (!(imageSize?.width > 0) || !(imageSize?.height > 0)) return empty;
  const { width, height } = imageSize;

  const resolvedById = new Map((annotations ?? []).map((a) => [a.id, a]));
  const annotationIds = cutOverlaps
    .map((o) => o.annotationId)
    .filter((id) => resolvedById.has(id));
  if (!annotationIds.length) return empty;

  const rawRows = (await db.annotations.bulkGet(annotationIds)).filter(Boolean);
  const rawById = new Map(rawRows.map((row) => [row.id, row]));

  // cuts carved by an opening: reflowOpeningsForHostService rewrites them
  const openingRels = await db.relAnnotationOpenings
    .where("hostAnnotationId")
    .anyOf(annotationIds)
    .toArray();
  const openingCutIds = new Set(
    openingRels.map((rel) => rel?.carve?.cutId).filter(Boolean)
  );

  const newPointRows = [];
  const updates = [];
  let mergedClusters = 0;
  let skippedClusters = 0;

  for (const overlap of cutOverlaps) {
    const resolved = resolvedById.get(overlap.annotationId);
    const raw = rawById.get(overlap.annotationId);
    if (!resolved || !raw) {
      skippedClusters += overlap.clusters.length;
      continue;
    }
    const resolvedCutById = new Map(
      (resolved.cuts ?? []).map((cut) => [cut.id, cut])
    );
    const rawCutById = new Map((raw.cuts ?? []).map((cut) => [cut.id, cut]));

    const mergedCutById = new Map(); // first cut id → merged raw cut
    const droppedCutIds = new Set();

    for (const cluster of overlap.clusters) {
      const rawCuts = cluster.cutIds.map((id) => rawCutById.get(id));
      const resolvedCuts = cluster.cutIds.map((id) => resolvedCutById.get(id));
      const isLocked =
        rawCuts.some((cut) => !cut) ||
        resolvedCuts.some((cut) => !cut) ||
        rawCuts.some(
          (cut) =>
            cut.cutHostId ||
            openingCutIds.has(cut.id) ||
            (cut.points ?? []).some(
              (ref) => typeof ref?.x === "number" || typeof ref?.y === "number"
            )
        );
      const merged = isLocked
        ? null
        : mergeCutRings(resolvedCuts, { collapseArcs: collapseArcsInPolyline });
      if (!merged) {
        skippedClusters += 1;
        continue;
      }

      const rawRefById = new Map();
      for (const cut of rawCuts) {
        for (const ref of cut.points ?? []) {
          if (ref?.id && !rawRefById.has(ref.id)) rawRefById.set(ref.id, ref);
        }
      }

      const refs = merged.points.map((p) => {
        if (p.id && rawRefById.has(p.id)) {
          return { ...rawRefById.get(p.id), type: p.type };
        }
        const id = nanoid();
        newPointRows.push({
          id,
          x: p.x / width,
          y: p.y / height,
          projectId: raw.projectId,
          baseMapId: raw.baseMapId,
          listingId: raw.listingId,
        });
        return { id, type: p.type };
      });

      const [firstCut, ...otherCuts] = rawCuts;
      // per-segment indexes no longer match the merged ring
      // eslint-disable-next-line no-unused-vars
      const { hiddenSegmentsIdx, ...firstCutProps } = firstCut;
      mergedCutById.set(firstCut.id, { ...firstCutProps, points: refs });
      otherCuts.forEach((cut) => droppedCutIds.add(cut.id));
      mergedClusters += 1;
    }

    if (mergedCutById.size > 0) {
      updates.push({
        id: raw.id,
        cuts: (raw.cuts ?? [])
          .filter((cut) => !droppedCutIds.has(cut.id))
          .map((cut) => mergedCutById.get(cut.id) ?? cut),
      });
    }
  }

  if (updates.length > 0) {
    await db.transaction("rw", db.annotations, db.points, async () => {
      if (newPointRows.length > 0) await db.points.bulkAdd(newPointRows);
      for (const update of updates) {
        await db.annotations.update(update.id, { cuts: update.cuts });
      }
    });
  }

  return {
    mergedAnnotationIds: updates.map((u) => u.id),
    mergedClusters,
    skippedClusters,
  };
}
