import { useEffect } from "react";
import { useSelector } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Mirrors `state.threedEditor.visibleBaseMapIdsIn3d` (image-eye toggle) and
// `state.threedEditor.annotationsModeByBaseMapIdIn3d` (per-basemap annotation
// display) to the 3D scene by toggling visibility flags — no scene reload.
//
// The image (meshWrap) and the annotations are decoupled:
//   - the basemap group is loaded + kept visible whenever the basemap
//     "participates" (its image OR its annotations should show),
//   - the image (meshWrap) is shown only when the eye is on,
// so a basemap's annotations can render even while its image is hidden.
//
// A basemap shown for the first time is lazily created once, then cached so
// subsequent toggles are a cheap flag flip. The main (selected) basemap always
// participates (its group stays loaded) but its image can be hidden through
// `hideMainBaseMapImageIn3d`. Mounted once from MainThreedEditor, same pattern
// as useApplyBaseMapOpacityIn3d.
//
// `rendererIsReady` MUST be a dependency: when the baseMaps resolve BEFORE the
// editor exists, every pass here is a no-op (no imagesManager) — without it,
// the pass that follows the editor creation never runs, useAutoLoadMaps
// creates the groups with their images visible by default and nothing hides
// them until an unrelated dep changes (startup flash of the baseMap images).
export default function useApplyBaseMapVisibilityIn3d({
  rendererIsReady,
} = {}) {
  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  // Global "Masquer les fonds de plan" switch: hides every basemap image
  // while keeping the groups (and their annotations) rendered.
  const hideBaseMaps = useSelector((s) => s.threedEditor.hideBaseMaps);
  // Opt-out image eye of the main basemap (chips overlay / position panel).
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps = [] } = useBaseMaps();

  const visibleKey = (visibleIds || []).join(",");
  const annotationsModeKey = Object.entries(annotationsModeByBaseMapId || {})
    .map(([id, mode]) => `${id}:${mode}`)
    .join(",");
  const baseMapsKey = baseMaps.map((b) => b.id).join(",");

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const imagesManager = editor?.sceneManager?.imagesManager;
    if (!imagesManager) return;

    const mainId = mainBaseMap?.id ?? null;
    const visible = new Set(visibleIds || []);
    const annoModes = annotationsModeByBaseMapId || {};

    // Single batch: the desired states are recorded in one pass (even for
    // groups not created yet — ImagesManager applies them at creation, so a
    // basemap loaded later never flashes its image before being hidden).
    const groupVisibleById = {};
    const imageVisibleById = {};
    baseMaps.forEach((bm) => {
      const eyeOn = bm.id === mainId ? !hideMainImage : visible.has(bm.id);
      const annoOn =
        bm.id === mainId || (annoModes[bm.id] && annoModes[bm.id] !== "NONE");
      const shouldParticipate = eyeOn || annoOn;

      if (shouldParticipate) {
        if (!imagesManager.hasTexturedImageObject(bm.id)) {
          editor.ensureBaseMapLoaded(bm);
        }
        groupVisibleById[bm.id] = true;
        imageVisibleById[bm.id] = eyeOn && !hideBaseMaps;
      } else {
        groupVisibleById[bm.id] = false;
      }
    });
    imagesManager.setBaseMapVisibilities({
      groupVisibleById,
      imageVisibleById,
    });
    editor.renderScene?.();
  }, [
    rendererIsReady,
    visibleKey,
    annotationsModeKey,
    mainBaseMap?.id,
    baseMapsKey,
    hideBaseMaps,
    hideMainImage,
  ]);
}
