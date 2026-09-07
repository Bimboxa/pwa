import { useSyncExternalStore } from "react";

import db from "App/db/db";

// Optimistic annotation updates that must SURVIVE a node unmount.
//
// A node that writes to Dexie and keeps the live value in component state
// (liveWidth pattern) flashes the old value whenever the write is followed
// by an unmount / remount before the liveQuery has caught up — e.g. a
// FREE_TEXT validated by a click outside: the blur writes on mousedown, the
// deselection on mouseup unmounts the EditedObjectLayer instance and mounts
// a fresh StaticMapContent one that only knows the (lagging) DB props.
//
// This module-level registry keeps the NORMALIZED updates (exactly what was
// written) per annotation id, so any mounted instance can merge them over
// its props. No timer: an entry goes away on a definite event only —
//   1. landed: the DB props equal the pending values (node-side check);
//   2. foreign write: any other write to the row after ours committed
//      (undo/redo put, panel field, drag commit, soft delete) — the row is
//      then by definition not what we wrote;
//   3. write failure (node-side clear).
// id -> { updates, committed }
const _entries = new Map();
const _listeners = new Set();
const _emit = () => _listeners.forEach((cb) => cb());
const _subscribe = (cb) => {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
};

// Returns the entry: a token so a later clear only applies while this entry
// is still the current one (a faster re-edit replaces it).
export function setPendingAnnotationUpdates(id, updates) {
  const entry = { updates, committed: false };
  _entries.set(id, entry);
  _emit();
  return entry;
}

// Rendering never depends on `committed`: mutated in place, no emit.
export function markPendingAnnotationUpdatesCommitted(entry) {
  entry.committed = true;
}

export function clearPendingAnnotationUpdates(id, entry) {
  if (entry && _entries.get(id) !== entry) return;
  if (_entries.delete(id)) _emit();
}

// The entry object itself is the snapshot (stable reference while unchanged).
export default function usePendingAnnotationUpdates(id) {
  return useSyncExternalStore(_subscribe, () => _entries.get(id) ?? null);
}

// Rule 2. Our own write fires the hook with committed === false: skipped.
const _onForeignWrite = (primKey) => {
  const entry = _entries.get(primKey);
  if (entry?.committed) clearPendingAnnotationUpdates(primKey, entry);
};
db.annotations.hook("updating", (mods, primKey) => _onForeignWrite(primKey));
db.annotations.hook("deleting", (primKey) => _onForeignWrite(primKey));
