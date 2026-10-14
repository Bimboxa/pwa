import { generateKeyBetween } from "fractional-indexing";
import { arrayMove } from "@dnd-kit/sortable";

import db, { withSystemWrite } from "App/db/db";

// ---------------------------------------------------------------------------
// useReorderScopes — dnd-kit `onDragEnd` handler of the sortable scope lists
// (top-bar scope selector, dashboard « Krtos » section): moves the dragged
// scope in the displayed order and rewrites the `sortIndex` of every scope
// whose key changes (fractional indexing, the field sortScopes sorts on).
//
// Full re-rank in the new display order: robust against legacy scopes with
// no sortIndex and against ties (a duplicated scope shares its source key).
//
// The order is shared display metadata, not owned content: written as a
// system write so non-owners can reorder too. `updatedAt` is passed back
// explicitly so the row keeps its date (the system-write branch of the
// updating hook only stamps it when missing): a reorder is not a content
// edit, it must not win a Krto « newest wins » merge nor change the date
// shown in the dashboard.
// ---------------------------------------------------------------------------

export default function useReorderScopes() {
  return async function reorderScopes({ active, over }, scopes) {
    if (!active || !over || active.id === over.id) return;
    try {
      const list = scopes ?? [];
      const oldIdx = list.findIndex((s) => s.id === active.id);
      const newIdx = list.findIndex((s) => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...list], oldIdx, newIdx);
      let prev = null;
      const updates = [];
      for (const s of reordered) {
        const sortIndex = generateKeyBetween(prev, null);
        if (s.sortIndex !== sortIndex) {
          updates.push({
            id: s.id,
            mods: { sortIndex, updatedAt: s.updatedAt ?? s.createdAt },
          });
        }
        prev = sortIndex;
      }
      if (!updates.length) return;

      await withSystemWrite(() =>
        db.transaction("rw", db.scopes, async () => {
          for (const u of updates) {
            await db.scopes.update(u.id, u.mods);
          }
        })
      );
    } catch (e) {
      console.error("[useReorderScopes] DnD reorder error:", e);
    }
  };
}
