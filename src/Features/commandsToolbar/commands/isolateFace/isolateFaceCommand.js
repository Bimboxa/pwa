import IconIsolateFace from "Features/icons/IconIsolateFace";

import { setIsolateFaceModeActive } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";
import { getThreedToolState } from "../../utils/drawToolCommandState";

// « Isoler une face » (S, 3D): threedEditor mode toggle — the letter / the
// button also disarm it.
export default {
  key: "ISOLATE_FACE",
  label: "Isoler une face",
  Icon: IconIsolateFace,
  editors: [EDITOR_3D],
  hotkey: { key: "s" },
  getState: (ctx) => getThreedToolState(ctx, ["ISOLATE_FACE"]),
  run(ctx, { dispatch, store }) {
    dispatch(
      setIsolateFaceModeActive(
        !store.getState().threedEditor.isolateFaceMode.active
      )
    );
  },
};
