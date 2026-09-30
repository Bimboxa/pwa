import {
  toggleBaseMapVisibleIn3d,
  toggleMainBaseMapImageIn3d,
} from "Features/threedEditor/threedEditorSlice";

// Image eye of a base map in the 3D viewer — the exact state and action of
// the layer icon of the base map chips (TopBaseMapChipsThreed): the main base
// map is driven by `hideMainBaseMapImageIn3d`, the others by
// `visibleBaseMapIdsIn3d`. The eye button of a sheet of the 3D base maps grid
// goes through these, so both always show and do the same thing.

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

export function getToggleBaseMapImageIn3dAction({ mainBaseMapId, baseMapId }) {
  return baseMapId === mainBaseMapId
    ? toggleMainBaseMapImageIn3d()
    : toggleBaseMapVisibleIn3d(baseMapId);
}
