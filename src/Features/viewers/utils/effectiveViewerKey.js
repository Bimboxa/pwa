// The left-band selection is a MODULE key; multi-editor modules (Dessin,
// POINT_OF_VIEW) display one of several editors. Components that gate their
// behavior on what is actually displayed (canvas, editor toolbars, tool
// hotkeys, camera sync) must use the effective key; module-driven UI (right
// panel, top bar, side panels) keeps reading selectedViewerKey.

import { isThreedFamilyViewerKey } from "./threedViewerKeys";

export const selectSelectedModuleKey = (s) => s.viewers.selectedViewerKey;

// 2D editor displayed by a multi-editor module: the BaseMap module owns its
// own MainMapEditorV3 instance ("BASE_MAPS"), every other module displays the
// shared "MAP" instance.
export const get2dEditorKeyForModule = (moduleKey) =>
  moduleKey === "BASE_MAPS" ? "BASE_MAPS" : "MAP";

// Key of the MainMapEditorV3 instance that must own the camera registry for
// the selected module (see MainMapEditorV3 registration effect).
export const selectActive2dEditorKey = (s) =>
  get2dEditorKeyForModule(s.viewers.selectedViewerKey);

export const selectIsPovViewer = (s) =>
  s.viewers.selectedViewerKey === "POINT_OF_VIEW";

export const selectEffectiveViewerKey = (s) => {
  const moduleKey = s.viewers.selectedViewerKey;
  // POINT_OF_VIEW keeps its own editor mode until it migrates to
  // editorKeyByModule (see issue #296).
  if (moduleKey === "POINT_OF_VIEW")
    return s.pov.viewerMode === "THREED" && !s.appConfig.disable3D
      ? "THREED"
      : "MAP";
  const editorKey = s.viewers.editorKeyByModule?.[moduleKey] ?? moduleKey;
  // disable3D: a module whose active editor is 3D falls back to its 2D editor
  // (the shared "MAP" instance, or the BaseMap module's own instance).
  if (editorKey === "THREED" && s.appConfig.disable3D) {
    if (
      ["MAP", "ZONES", "BUSINESS_OBJECTS", "THREED", "BASE_MAPS"].includes(
        moduleKey
      )
    )
      return get2dEditorKeyForModule(moduleKey);
  }
  return editorKey;
};

// The POV capture frame is armed on demand only ("Créer une vue", or picking a
// view in the list), not for the whole module: with it off, the POV module
// behaves like the regular editor (PopperMapListings visible, editing free).
export const selectPovFramingActive = (s) =>
  selectIsPovViewer(s) && s.pov.framingActive;

// Key of the [data-image-capture-host] element to snapshot / measure for the
// displayed editor: every 3D-family editor shares the single "THREED" host
// (MainThreedEditor), the 2D editors each stamp their own key.
export const selectCaptureHostViewerKey = (s) => {
  const effectiveKey = selectEffectiveViewerKey(s);
  return isThreedFamilyViewerKey(effectiveKey) ? "THREED" : effectiveKey;
};

// The capture framing ("Export rapide" mask + rect + legend) is active when
// the Export tool enabled it, when the global Capture tool (hotkey V) armed it,
// OR when the POV viewer armed its frame. Editing interactions gated on image
// mode must use this derived flag so every framing freezes them exactly like
// the Export tool does.
export const selectCaptureFramingActive = (s) =>
  s.mapEditor.imageModeEnabled ||
  s.mapEditor.captureToolActive ||
  selectPovFramingActive(s);

// Generation date of the restored POV, or null when nothing is frozen.
// Annotations created after it are filtered out by useAnnotationsV2, so the
// restored view matches its saved image. Gated on the POV viewer: leaving the
// module unfreezes everything, no cleanup needed.
export const selectPovFreezeCreatedBefore = (s) =>
  selectIsPovViewer(s) ? (s.pov.viewFreeze?.createdBefore ?? null) : null;
