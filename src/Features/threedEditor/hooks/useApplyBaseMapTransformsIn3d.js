import { useEffect } from "react";
import { useSelector } from "react-redux";

import db from "App/db/db";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Re-applies basemap placement (position / rotation, and plane size on a
// `meterByPx` change) to the already-loaded 3D groups whenever a basemap is
// changed — mirrors useApplyBaseMapVisibilityIn3d (a live, no-reload update).
//
// Driven by the `baseMapsUpdatedAt` counter (bumped via `triggerBaseMapsUpdate`
// after every placement edit) rather than the resolved `baseMaps` array, so it
// doesn't depend on an object reference. The fresh records are read straight
// from `db.baseMaps` inside the effect — the counter is dispatched AFTER the
// `db.baseMaps.update(...)` awaits, so the DB already holds the new values and
// there's no race with the async `useLiveQuery` resolution.
//
// The initial scene load is still handled by useAutoLoadMapsInThreedEditor;
// this hook only handles subsequent changes (it no-ops while the counter is
// null). Mounted once from MainThreedEditor.
export default function useApplyBaseMapTransformsIn3d() {
  const baseMapsUpdatedAt = useSelector((s) => s.baseMaps.baseMapsUpdatedAt);

  useEffect(() => {
    if (!baseMapsUpdatedAt) return;
    const editor = getActiveThreedEditor();
    const imagesManager = editor?.sceneManager?.imagesManager;
    if (!imagesManager) return;

    const ids = imagesManager.getLoadedBaseMapIds();
    if (!ids.length) return;

    let cancelled = false;
    (async () => {
      const records = await db.baseMaps.bulkGet(ids);
      if (cancelled) return;
      records.forEach((r) => r && editor.applyBaseMapPlacement(r));
      editor.renderScene?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [baseMapsUpdatedAt]);
}
