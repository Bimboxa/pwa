import IconAxesFrame from "Features/icons/IconAxesFrame";

import { setShowSceneAxes } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";

// « Afficher le repère » (3D): toggles the coloured axes helper of the user
// frame in the scene (threedEditor.axesSettings.showSceneAxes — the same
// device preference as the « Afficher les axes dans la scène » switch of
// the 3D view settings). The orientation gizmo at the top right keeps its
// own switch. Its origin is a snappable point while shown.
export default {
  key: "TOGGLE_AXES",
  label: "Afficher le repère",
  Icon: IconAxesFrame,
  editors: [EDITOR_3D],
  getState(ctx) {
    return { enabled: true, active: Boolean(ctx.showSceneAxes) };
  },
  run(ctx, { dispatch }) {
    dispatch(setShowSceneAxes(!ctx.showSceneAxes));
  },
};
