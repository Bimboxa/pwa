import db, { isSystemWrite } from "App/db/db";
import store from "App/store";

import { triggerRelsPhaseAnnotationUpdate } from "../phasingSlice";

import setAnnotationsPhasesService from "./setAnnotationsPhasesService";

import sortPhases from "../utils/sortPhases";
import getNewAnnotationPhaseIndexes from "../utils/getNewAnnotationPhaseIndexes";

// Assigns the annotations just created to the selected phases
// (phasing.selectedPhaseIds). Annotations are created from many places (2D /
// 3D drawing, paste, clones, procedures, generated children…): the request
// comes from the table itself rather than from each of them — like the
// block instances of requestSubtractOnContactSync. Importing this module
// registers the hook.
//
// Not assigned: system writes (Krto import, remote sync, scope duplication —
// they carry their own phase rows) and base map annotations.
// The write pushes no undo entry: undoing the creation leaves rows pointing
// at a deleted annotation, which nothing reads.

// A paste / a procedure writes N rows: one batch once the burst settles.
const DEBOUNCE_MS = 100;

const pendingIds = new Set();
let timer = null;
let running = false;

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
  timer = null;
  if (running) {
    schedule();
    return;
  }
  if (pendingIds.size === 0) return;
  const annotationIds = [...pendingIds];
  pendingIds.clear();
  running = true;
  try {
    const phasingState = store.getState().phasing;
    const selectedPhaseIds = phasingState?.selectedPhaseIds ?? [];
    if (selectedPhaseIds.length === 0) return;
    const selected = (
      await db.businessObjects.bulkGet(selectedPhaseIds)
    ).filter((o) => o && !o.deletedAt);
    const listingId = selected[0]?.listingId;
    if (!listingId) return;
    const listing = await db.listings.get(listingId);
    if (!listing || listing.deletedAt) return;
    const phases = sortPhases(
      await db.businessObjects.where("listingId").equals(listingId).toArray()
    );
    const selectedIds = new Set(selected.map((o) => o.id));
    // one selected phase: that phase only, or that phase and after (strip
    // block « Nouvelle annotation »); several: the selected phases
    const indexes = getNewAnnotationPhaseIndexes(
      phases
        .map((phase, index) => (selectedIds.has(phase.id) ? index : -1))
        .filter((index) => index >= 0),
      phases.length,
      phasingState?.newAnnotationPeriodMode
    );
    if (indexes.length === 0) return;

    // the creation may have been undone / rolled back meanwhile
    const live = (await db.annotations.bulkGet(annotationIds)).filter(
      (a) => a && !a.deletedAt && !a.isBaseMapAnnotation
    );
    if (live.length === 0) return;

    const written = await setAnnotationsPhasesService({
      listing,
      phases,
      indexesByAnnotationId: new Map(live.map((a) => [a.id, new Set(indexes)])),
      skipUndo: true,
    });
    if (written > 0) store.dispatch(triggerRelsPhaseAnnotationUpdate());
  } catch (error) {
    console.warn("[phasing] assign on create failed", error);
  } finally {
    running = false;
    if (pendingIds.size > 0) schedule();
  }
}

db.annotations.hook("creating", (primKey, obj) => {
  if (isSystemWrite()) return;
  if (obj?.isBaseMapAnnotation) return;
  const id = obj?.id ?? primKey;
  if (!id) return;
  // cheap guard: nothing is queued while no phase is selected
  if (!store.getState().phasing?.selectedPhaseIds?.length) return;
  pendingIds.add(id);
  schedule();
});
