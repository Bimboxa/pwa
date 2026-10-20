import IconMergeFaces from "Features/icons/IconMergeFaces";

import activateMergeFacesTool from "Features/threedMergeFaces/utils/activateMergeFacesTool";

import { EDITOR_3D } from "../../constants/commandEditors";
import { getThreedToolState } from "../../utils/drawToolCommandState";

// « Fusionner des faces » (3D — Features/threedMergeFaces): arms the merge
// mode; exactly one selected face is its seed (the former « Fusionner »
// overlay button of the face row), else the first clicked face becomes it.
// Toggles off when armed.
export default {
  key: "MERGE_FACES",
  label: "Fusionner des faces",
  Icon: IconMergeFaces,
  editors: [EDITOR_3D],
  getState: (ctx) => getThreedToolState(ctx, ["MERGE_FACES"]),
  run(ctx, { dispatch, store, getThreedEditor }) {
    activateMergeFacesTool({
      dispatch,
      state: store.getState(),
      editor: getThreedEditor(),
    });
  },
};
