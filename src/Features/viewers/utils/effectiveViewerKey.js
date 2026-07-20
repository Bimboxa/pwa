// The left-band selection is a MODULE key; multi-editor modules (Dessin,
// POINT_OF_VIEW) display one of several editors. Components that gate their
// behavior on what is actually displayed (canvas, editor toolbars, tool
// hotkeys, camera sync) must use the effective key; module-driven UI (right
// panel, top bar, side panels) keeps reading selectedViewerKey.

export const selectSelectedModuleKey = (s) => s.viewers.selectedViewerKey;

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
  // disable3D: a module whose active editor is 3D falls back to its 2D editor.
  if (
    editorKey === "THREED" &&
    ["MAP", "ZONES"].includes(moduleKey) &&
    s.appConfig.disable3D
  )
    return moduleKey;
  return editorKey;
};

// The capture framing ("Export rapide" mask + rect + legend) is active when
// the Export tool enabled it OR when the POV viewer is displayed. Editing
// interactions gated on image mode must use this derived flag so the POV
// viewer freezes them exactly like the Export tool does.
export const selectCaptureFramingActive = (s) =>
  s.mapEditor.imageModeEnabled || selectIsPovViewer(s);
