import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import {
  SEGMENT_FLAG_FIELDS,
  getAnnotationRingClosed,
  getRingSegmentFlagPointIds,
  remapSegmentPointIdsAfterInsert,
} from "Features/annotations/utils/segmentFlags";
import findPolylineIntersections, {
  expandRefsToChords,
} from "Features/geometry/utils/findPolylineIntersections";
import splitArcOnInsert from "Features/geometry/utils/splitArcOnInsert";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import { setToaster } from "Features/layout/layoutSlice";

// A crossing closer than this to an existing square vertex reuses that vertex
// (the annotations already meet there) instead of inserting a twin.
const VERTEX_EPS_PX = 0.5;

/**
 * « Ajouter les points d'intersection »: insert a vertex in BOTH annotations
 * at every crossing of their main rings. The two annotations share one point
 * id per crossing (one db.points row), the project's convention for a
 * junction. Arcs are preserved (splitArcOnInsert), the per-segment flags are
 * remapped on the inserted points and the whole write is one undo step.
 *
 * Works on the RAW db rows (never the resolved pixel points: a ref must stay a
 * `{id, type?}` reference). Main rings only: cuts / guide lines are untouched.
 * `meshLinesBySegment` (indexed by position) is not remapped, like the other
 * insertion paths.
 */
export default async function addIntersectionPointsService({
  annotationIds,
  baseMap,
  meterByPx,
  projectId,
  dispatch,
}) {
  const toast = (message, isError = false) =>
    dispatch?.(setToaster({ message, isError }));

  const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) {
    toast("Taille de l'image indisponible", true);
    return { status: "error" };
  }

  const [idA, idB] = annotationIds ?? [];
  const rows = await db.annotations.bulkGet([idA, idB]);
  const [rawA, rawB] = rows;
  if (!rawA || !rawB) {
    toast("Annotation introuvable", true);
    return { status: "error" };
  }

  // Pixel resolver over db.points (legacy inline normalized x/y as fallback).
  const refIds = [
    ...new Set(
      [...(rawA.points ?? []), ...(rawB.points ?? [])].map((p) => p.id)
    ),
  ];
  const records = await db.points.bulkGet(refIds);
  const pxById = {};
  records.forEach((r, i) => {
    if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)) return;
    pxById[refIds[i]] = { x: r.x * imageSize.width, y: r.y * imageSize.height };
  });
  [...(rawA.points ?? []), ...(rawB.points ?? [])].forEach((p) => {
    if (pxById[p.id] || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    pxById[p.id] = { x: p.x * imageSize.width, y: p.y * imageSize.height };
  });
  const getPx = (id) => pxById[id];

  const works = [rawA, rawB].map((raw) => ({
    raw,
    closed: getAnnotationRingClosed(raw),
    basePoints: raw.points ?? [],
    points: raw.points ?? [],
  }));
  if (works.some((w) => w.basePoints.length < (w.closed ? 3 : 2))) {
    toast("Polyligne trop courte", true);
    return { status: "error" };
  }

  const hits = findPolylineIntersections(
    { refs: works[0].points, getPx, closed: works[0].closed },
    { refs: works[1].points, getPx, closed: works[1].closed }
  );
  if (hits.length === 0) {
    toast("Aucune intersection entre les deux annotations");
    return { status: "no_intersection", count: 0 };
  }

  // New db.points rows (normalized), written before the annotation updates.
  const newPointRows = [];
  const pushRowFromPx = (id, px, listingId) => {
    pxById[id] = { x: px.x, y: px.y };
    newPointRows.push({
      id,
      x: px.x / imageSize.width,
      y: px.y / imageSize.height,
      baseMapId: rawA.baseMapId,
      projectId: projectId ?? rawA.projectId,
      listingId,
    });
  };

  const findNearVertex = (work, hit) => {
    for (const ref of work.points) {
      if (ref?.type === "circle") continue;
      const px = getPx(ref.id);
      if (px && Math.hypot(px.x - hit.x, px.y - hit.y) <= VERTEX_EPS_PX)
        return ref;
    }
    return null;
  };

  // Insert `id` at `hit` on the chord of the CURRENT refs closest to it (the
  // refs change at every insertion, so the arc half is located again each
  // time: splitArcOnInsert then always places its new control between the
  // right anchors).
  const insertAt = (work, id, hit) => {
    const chords = expandRefsToChords(work.points, getPx, work.closed);
    let best = null;
    let bestD = Infinity;
    for (const c of chords) {
      const d = distanceToSegment(hit, c.a, c.b);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return false;
    const { points, newCircle } = splitArcOnInsert({
      points: work.points,
      segmentStartIndex: best.rawStartIdx,
      newRef: { id, type: "square" },
      newPx: hit,
      getPx,
      closed: work.closed,
      makeId: () => nanoid(),
    });
    work.points = points;
    if (newCircle) pushRowFromPx(newCircle.id, newCircle, work.raw.listingId);
    return true;
  };

  let count = 0;
  for (const hit of hits) {
    const existing = works.map((w) => findNearVertex(w, hit));
    if (existing[0] && existing[1]) continue;
    let id = existing[0]?.id ?? existing[1]?.id;
    if (!id) {
      id = nanoid();
      pushRowFromPx(id, hit, rawA.listingId);
    }
    let inserted = false;
    works.forEach((w, i) => {
      if (!existing[i]) inserted = insertAt(w, id, hit) || inserted;
    });
    if (inserted) count += 1;
  }

  if (count === 0) {
    toast("Les deux annotations partagent déjà leurs points d'intersection");
    return { status: "nothing_to_add", count: 0 };
  }

  // Per-segment flags follow the insertions (both halves of a flagged
  // segment stay flagged); the legacy index fields are cleared on write.
  const updates = works.map((w) => {
    const changes = { points: w.points };
    SEGMENT_FLAG_FIELDS.forEach(({ idxField, idField }) => {
      const ids = getRingSegmentFlagPointIds(
        w.raw,
        idxField,
        idField,
        w.basePoints,
        { closed: w.closed }
      );
      if (w.raw[idxField] !== undefined) changes[idxField] = undefined;
      if (ids == null || ids.length === 0) return;
      changes[idField] = remapSegmentPointIdsAfterInsert(
        w.basePoints,
        w.points,
        ids,
        { closed: w.closed }
      );
    });
    return { id: w.raw.id, changes };
  });

  await withUndoGroup(async () => {
    await db.transaction("rw", [db.annotations, db.points], async () => {
      if (newPointRows.length > 0) await db.points.bulkAdd(newPointRows);
      for (const u of updates) await db.annotations.update(u.id, u.changes);
    });
  });

  dispatch?.(triggerAnnotationsUpdate());

  // Openings hosted on either line re-anchor on the new refs.
  if (projectId && Number.isFinite(meterByPx) && meterByPx > 0) {
    try {
      await reflowOpeningsForHost({
        hostIds: [rawA.id, rawB.id],
        projectId,
        imageSize,
        meterByPx,
      });
    } catch (e) {
      console.error("[openings] reflow failed", e);
    }
  }

  toast(
    count > 1
      ? `${count} points d'intersection ajoutés`
      : "1 point d'intersection ajouté"
  );
  return { status: "done", count };
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
