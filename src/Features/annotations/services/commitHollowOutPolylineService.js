import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import {
  SEGMENT_FLAG_FIELDS,
  segmentIdxToPointIds,
} from "../utils/segmentFlags";

// "Evider" of a POLYLINE / STRIP: write step. The geometry is computed
// upstream (getHollowOutPolylineCarve, previewed in DialogHollowOutAnnotation):
// `carved.chains` are the open chains of the centerline left outside the
// cutting footprints, longest first, in pixel space.
//
// The longest chain keeps the original annotation; each other chain becomes a
// new annotation cloned from the RAW db record (the resolved annotation
// carries template-enriched / display-only fields that must not be
// persisted), with its mapping-category rels.
//
// Points: an unchanged vertex keeps its db.points id (each one ends up in a
// single chain), a cut point gets a new db.points row, NORMALIZED vs the base
// map image (docs/annotations/POINTS_STORAGE.md). Heights live on the refs:
// kept as they are on the vertices, interpolated along the source segment on
// the cut points (done by the carve).
//
// One transaction for the whole carve. Returns true when something was
// written — the caller notifies the annotations observers.
export default async function commitHollowOutPolylineService({
  annotation,
  carved,
  imageSize,
}) {
  if (!annotation?.id || !imageSize?.width || !imageSize?.height) return false;
  if (!carved || carved.consumed) return false;
  const chains = (carved.chains ?? []).filter(
    (chain) => chain?.points?.length >= 2
  );
  if (chains.length === 0) return false;
  const { width, height } = imageSize;

  // Reads up-front — writes are batched in a single transaction below.
  const firstPointId = annotation.points?.find((p) => p?.id)?.id;
  const [samplePoint, raw] = await Promise.all([
    firstPointId ? db.points.get(firstPointId) : null,
    db.annotations.get(annotation.id),
  ]);
  if (!raw) return false;

  // Scope fields for new db.points rows: copy from an existing stored point.
  const pointScope = {
    baseMapId: samplePoint?.baseMapId ?? annotation.baseMapId,
    projectId: samplePoint?.projectId ?? annotation.projectId,
    listingId: samplePoint?.listingId ?? annotation.listingId,
  };

  const round = (v) => Math.round(v * 1e6) / 1e6;
  const pointsToSave = [];
  const toRef = (px) => {
    let id = px.id;
    if (!id) {
      id = nanoid();
      pointsToSave.push({
        id,
        x: px.x / width,
        y: px.y / height,
        ...pointScope,
      });
    }
    const ref = { id };
    if (px.offsetBottom) ref.offsetBottom = round(px.offsetBottom);
    if (px.offsetTop) ref.offsetTop = round(px.offsetTop);
    return ref;
  };

  // Chain flags (segment indices on the chain) → start-point ids on its refs.
  // Chains are open: the last point starts no segment.
  const getFlagIds = (chain, refs) => {
    const flagIds = {};
    for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
      const ids = segmentIdxToPointIds(
        chain.segmentFlags?.[idxField] ?? [],
        refs,
        { closed: false }
      );
      if (ids.length > 0) flagIds[idField] = ids;
    }
    return flagIds;
  };

  const clonedProps = { ...raw };
  delete clonedProps.id;
  delete clonedProps.points;
  delete clonedProps.cuts;
  delete clonedProps.entityId;
  for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
    delete clonedProps[idxField];
    delete clonedProps[idField];
  }
  delete clonedProps.createdAt;
  delete clonedProps.updatedAt;
  delete clonedProps.createdByUserIdMaster;
  delete clonedProps.updatedByUserIdMaster;
  delete clonedProps.deletedAt;
  delete clonedProps.deletedByUserIdMaster;
  // A carved line is never a closed loop anymore.
  if (clonedProps.closeLine) clonedProps.closeLine = false;

  const [keptChain, ...extraChains] = chains;

  const keptRefs = keptChain.points.map(toRef);
  const keptChanges = { points: keptRefs, ...getFlagIds(keptChain, keptRefs) };
  if (raw.closeLine) keptChanges.closeLine = false;
  // Flags are rewritten id-keyed for the kept chain: drop what does not
  // apply anymore, and the legacy index fields (migrate-on-write).
  for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
    if (raw[idxField] !== undefined) keptChanges[idxField] = undefined;
    if (raw[idField] !== undefined && keptChanges[idField] === undefined) {
      keptChanges[idField] = undefined;
    }
  }

  const newAnnotationRows = extraChains.map((chain) => {
    const refs = chain.points.map(toRef);
    return {
      ...clonedProps,
      id: nanoid(),
      points: refs,
      ...getFlagIds(chain, refs),
    };
  });

  // Mapping-category rels for the cloned annotations (same as
  // useCommitHollowOut).
  let newRels = [];
  if (newAnnotationRows.length > 0 && raw.annotationTemplateId) {
    const template = await db.annotationTemplates.get(raw.annotationTemplateId);
    const mappingCategories = (template?.mappingCategories ?? [])
      .map((entry) => {
        if (typeof entry === "string") {
          const parts = entry.split(":").map((s) => s.trim());
          return parts.length === 2 && parts[0] && parts[1]
            ? { nomenclatureKey: parts[0], categoryKey: parts[1] }
            : null;
        }
        return entry?.nomenclatureKey && entry?.categoryKey ? entry : null;
      })
      .filter(Boolean);
    newRels = newAnnotationRows.flatMap((row) =>
      mappingCategories.map((mc) => ({
        id: nanoid(),
        annotationId: row.id,
        projectId: raw.projectId,
        nomenclatureKey: mc.nomenclatureKey,
        categoryKey: mc.categoryKey,
        source: "annotationTemplate",
      }))
    );
  }

  await db.transaction(
    "rw",
    [db.points, db.annotations, db.relAnnotationMappingCategory],
    async () => {
      if (pointsToSave.length > 0) await db.points.bulkAdd(pointsToSave);
      await db.annotations.update(annotation.id, keptChanges);
      if (newAnnotationRows.length > 0) {
        await db.annotations.bulkAdd(newAnnotationRows);
      }
      if (newRels.length > 0) {
        await db.relAnnotationMappingCategory.bulkAdd(newRels);
      }
    }
  );

  return true;
}
