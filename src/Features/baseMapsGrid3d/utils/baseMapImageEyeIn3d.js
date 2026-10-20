import {
  setBaseMapAnnotationsModeIn3d,
  toggleBaseMapVisibleIn3d,
  toggleMainBaseMapAnnotationsIn3d,
  toggleMainBaseMapImageIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// Image eye / annotations badge of a base map in the 3D viewer — the exact
// states and actions of the eye / badge of the base maps list
// (SectionBaseMapsList): the main base map is driven by
// `hideMainBaseMapImageIn3d` / `hideMainBaseMapAnnotationsIn3d`, the others
// by `visibleBaseMapIdsIn3d` / `annotationsModeByBaseMapIdIn3d`. The eye and
// badge buttons of a sheet of the 3D base maps grid go through these, so
// both always show and do the same thing.

// threedEditor: state.threedEditor. mainBaseMapId: mapEditor.selectedBaseMapId.
export function isBaseMapImageOnIn3d({
  threedEditor,
  mainBaseMapId,
  baseMapId,
}) {
  if (baseMapId === mainBaseMapId) {
    return !threedEditor.hideMainBaseMapImageIn3d;
  }
  return (threedEditor.visibleBaseMapIdsIn3d ?? []).includes(baseMapId);
}

// Annotations of the base map displayed in the 3D viewer (badge of the chip).
export function isBaseMapAnnotationsOnIn3d({
  threedEditor,
  mainBaseMapId,
  baseMapId,
}) {
  if (baseMapId === mainBaseMapId) {
    return !threedEditor.hideMainBaseMapAnnotationsIn3d;
  }
  const mode = threedEditor.annotationsModeByBaseMapIdIn3d?.[baseMapId];
  return Boolean(mode) && mode !== "NONE";
}

export function getToggleBaseMapImageIn3dAction({ mainBaseMapId, baseMapId }) {
  return baseMapId === mainBaseMapId
    ? toggleMainBaseMapImageIn3d()
    : toggleBaseMapVisibleIn3d(baseMapId);
}

// Badge of the base maps list: the main base map flips its hide flag, the
// others switch NONE ⇄ NORMAL (a DIMMED mode counts as on).
export function getToggleBaseMapAnnotationsIn3dAction({
  threedEditor,
  mainBaseMapId,
  baseMapId,
}) {
  if (baseMapId === mainBaseMapId) return toggleMainBaseMapAnnotationsIn3d();
  const on = isBaseMapAnnotationsOnIn3d({
    threedEditor,
    mainBaseMapId,
    baseMapId,
  });
  return setBaseMapAnnotationsModeIn3d({
    baseMapId,
    mode: on ? ANNOTATIONS_DISPLAY_MODE.NONE : ANNOTATIONS_DISPLAY_MODE.NORMAL,
  });
}
