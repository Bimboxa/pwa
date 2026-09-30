import {
  setBaseMapAnnotationsModeIn3d,
  setHideMainBaseMapAnnotationsIn3d,
  setHideMainBaseMapImageIn3d,
  toggleBaseMapVisibleIn3d,
} from "Features/threedEditor/threedEditorSlice";

import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// "Content" of a base map in the 3D viewer = its image OR its annotations,
// the two toggles of the base map chips (threedEditor slice). The eye button
// of a sheet of the 3D base maps grid drives both at once, through the same
// state — the chips band and the position panel stay in sync.

// threedEditor: state.threedEditor. mainBaseMapId: mapEditor.selectedBaseMapId.
export function isBaseMapContentVisibleIn3d({
  threedEditor,
  mainBaseMapId,
  baseMapId,
}) {
  if (baseMapId === mainBaseMapId) {
    return (
      !threedEditor.hideMainBaseMapImageIn3d ||
      !threedEditor.hideMainBaseMapAnnotationsIn3d
    );
  }
  const imageOn = (threedEditor.visibleBaseMapIdsIn3d ?? []).includes(
    baseMapId
  );
  const mode = threedEditor.annotationsModeByBaseMapIdIn3d?.[baseMapId];
  const annotationsOn = Boolean(mode) && mode !== ANNOTATIONS_DISPLAY_MODE.NONE;
  return imageOn || annotationsOn;
}

// Actions showing (image + annotations) or hiding (both) a base map's content.
export function getToggleBaseMapContentIn3dActions({
  threedEditor,
  mainBaseMapId,
  baseMapId,
}) {
  const visible = isBaseMapContentVisibleIn3d({
    threedEditor,
    mainBaseMapId,
    baseMapId,
  });

  if (baseMapId === mainBaseMapId) {
    return [
      setHideMainBaseMapImageIn3d(visible),
      setHideMainBaseMapAnnotationsIn3d(visible),
    ];
  }

  const imageOn = (threedEditor.visibleBaseMapIdsIn3d ?? []).includes(
    baseMapId
  );
  const actions = [];
  // show: image eye on — hide: image eye off
  if (imageOn === visible) actions.push(toggleBaseMapVisibleIn3d(baseMapId));
  actions.push(
    setBaseMapAnnotationsModeIn3d({
      baseMapId,
      mode: visible
        ? ANNOTATIONS_DISPLAY_MODE.NONE
        : ANNOTATIONS_DISPLAY_MODE.NORMAL,
    })
  );
  return actions;
}
