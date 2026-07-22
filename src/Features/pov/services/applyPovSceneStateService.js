import db from "App/db/db";
import store from "App/store";

import { setPovViewerMode, setPovViewFreeze } from "../povSlice";
import {
  setImageModeAspectRatio,
  setImageModeLegendOverlay,
  setImageModeWhiteBackground,
  setImageModeBorder,
  setImageModeTitle,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
import {
  setVisibleBaseMapIdsIn3d,
  setHideMainBaseMapImageIn3d,
  setHideMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";

import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";

// Everything of a saved view EXCEPT the camera: displayed 2D/3D editor, frame
// ratio + legend + background, annotation templates visibility, baseMaps and
// their active versions.
//
// Split out of restorePovViewService so the video generator can apply a POV's
// scene without the deferred camera jump (it drives the camera itself, frame
// by frame).
//
// `overrideAspectRatio` keeps one single frame ratio for a whole video: the
// output dimensions are fixed, so the per-POV ratio must not be re-dispatched.
//
// Returns {skipped, viewerMode, mainBaseMapId, mainBaseMapExists}.
export default async function applyPovSceneStateService({
  pov,
  dispatch,
  overrideAspectRatio,
}) {
  if (!pov) return { skipped: true };

  const state = store.getState();
  const viewerMode = pov.viewerMode === "THREED" ? "THREED" : "MAP";
  const disable3D = state.appConfig.disable3D;
  if (viewerMode === "THREED" && disable3D) {
    // Nothing to apply: no 3D editor available.
    return { skipped: true, viewerMode };
  }

  // 1. displayed editor (plain flip: the camera is overwritten right after)
  if (state.pov.viewerMode !== viewerMode) {
    dispatch(setPovViewerMode(viewerMode));
  }

  // 1 bis. content freeze — dispatched first so the annotations re-query runs
  // while the rest of the scene is applied. Views saved before viewCreatedAt
  // existed simply keep showing the live annotations.
  dispatch(
    setPovViewFreeze(
      pov.viewCreatedAt
        ? { povId: pov.id, createdBefore: pov.viewCreatedAt }
        : null
    )
  );

  // 2. frame + legend + background
  const aspectRatio = overrideAspectRatio ?? pov.aspectRatio;
  if (aspectRatio) dispatch(setImageModeAspectRatio(aspectRatio));
  if (pov.legendOverlay) dispatch(setImageModeLegendOverlay(pov.legendOverlay));
  if (pov.whiteBackground !== undefined)
    dispatch(setImageModeWhiteBackground(Boolean(pov.whiteBackground)));
  if (pov.border !== undefined)
    dispatch(setImageModeBorder(Boolean(pov.border)));
  if (pov.title !== undefined) dispatch(setImageModeTitle(pov.title));

  // 3. annotation templates visibility — one batch write, only where the
  // hidden flag actually changes (useUpdateAnnotationTemplates pattern).
  //
  // `visibleAnnotationTemplateIds` is a WHITELIST: every template outside of
  // it is hidden, which also covers templates created after the view was
  // saved. Older records only carry the legacy blacklist.
  const projectId = pov.projectId ?? state.projects.selectedProjectId;
  const visibleIds = pov.visibleAnnotationTemplateIds;
  const hiddenIds = pov.hiddenAnnotationTemplateIds;
  if ((visibleIds || hiddenIds) && projectId) {
    const visibleSet = visibleIds ? new Set(visibleIds) : null;
    const hiddenSet = new Set(hiddenIds ?? []);
    const isHidden = (t) =>
      visibleSet ? !visibleSet.has(t.id) : hiddenSet.has(t.id);

    const templates = await db.annotationTemplates
      .where("projectId")
      .equals(projectId)
      .toArray();
    const updates = templates
      .filter((t) => !t.deletedAt)
      .filter((t) => Boolean(t.hidden) !== isHidden(t))
      .map((t) => ({ key: t.id, changes: { hidden: isHidden(t) } }));
    if (updates.length > 0) {
      await db.transaction("rw", [db.annotationTemplates], async () => {
        await db.annotationTemplates.bulkUpdate(updates);
      });
      dispatch(triggerAnnotationTemplatesUpdate());
      dispatch(triggerAnnotationsUpdate());
    }
  }

  // 4. baseMaps + active versions (guarded: references may have been deleted)
  const povBaseMaps = pov.baseMaps ?? {};
  const { mainBaseMapId, activeVersionIdByBaseMapId } = povBaseMaps;

  let mainBaseMapExists = false;
  if (mainBaseMapId) {
    const mainBaseMap = await db.baseMaps.get(mainBaseMapId);
    mainBaseMapExists = Boolean(mainBaseMap && !mainBaseMap.deletedAt);
    if (
      mainBaseMapExists &&
      state.mapEditor.selectedBaseMapId !== mainBaseMapId
    ) {
      dispatch(setSelectedMainBaseMapId(mainBaseMapId));
    }
  }

  for (const [baseMapId, versionId] of Object.entries(
    activeVersionIdByBaseMapId ?? {}
  )) {
    const version = await db.baseMapVersions.get(versionId);
    if (!version || version.deletedAt) continue;
    if (version.isActive) continue;
    await activateBaseMapVersion(baseMapId, versionId, dispatch);
  }

  if (viewerMode === "THREED") {
    dispatch(setVisibleBaseMapIdsIn3d(povBaseMaps.visibleBaseMapIdsIn3d ?? []));
    dispatch(
      setHideMainBaseMapImageIn3d(Boolean(povBaseMaps.hideMainBaseMapImageIn3d))
    );
    dispatch(
      setHideMainBaseMapAnnotationsIn3d(
        Boolean(povBaseMaps.hideMainBaseMapAnnotationsIn3d)
      )
    );
  }

  return { skipped: false, viewerMode, mainBaseMapId, mainBaseMapExists };
}
