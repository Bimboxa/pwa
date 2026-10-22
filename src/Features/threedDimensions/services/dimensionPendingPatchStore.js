// Fields of a COTE / RULER row that are written to the DB but not yet read
// back by the live query (the value-card drag hooks → pointerup: a cote's
// `extensionOffset` / `offset3d`, a ruler's `rulerLabelOffsets`).
//
// Between the write and the live query's new annotations array, any rebuild
// of the renderer (a selection change, an annotations load tick) would read
// the row's OLD fields and snap the cards back for a frame. The renderers
// therefore merge the entry here over the row while the row they render is
// still the one the drag started from — identified by its `updatedAt`, which
// the Dexie audit hook re-stamps on every update. Once the row changes (the
// write landed, or any other write / undo), the entry is dropped and the row
// wins. No timers: purely data-driven.

const _byAnnotationId = new Map();

// `baseUpdatedAt`: the row's updatedAt BEFORE the write; `patch`: the fields
// being written.
export function setPendingDimensionPatch(
  annotationId,
  { baseUpdatedAt, patch }
) {
  _byAnnotationId.set(annotationId, {
    baseUpdatedAt: baseUpdatedAt ?? null,
    patch: patch || {},
  });
}

export function clearPendingDimensionPatch(annotationId) {
  _byAnnotationId.delete(annotationId);
}

// The row to render: the pending fields merged over it while it is still the
// pre-write row, else the row as is (the entry is dropped then).
export function applyPendingDimensionPatch(row) {
  const pending = _byAnnotationId.get(row?.id);
  if (!pending) return row;
  if ((row?.updatedAt ?? null) === pending.baseUpdatedAt) {
    return { ...row, ...pending.patch };
  }
  _byAnnotationId.delete(row.id);
  return row;
}
