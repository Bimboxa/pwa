import IconFaceCut from "Features/icons/IconFaceCut";

import { EDITOR_3D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Coupe face » (C, 3D — Features/threedFaceCut): variants segment /
// polyline / rectangle / horizontal / vertical cuts of a face. « C » is
// « Copier » of the 3D « Déplacer » while that mode is active: the hotkey
// yields.
export default createToolGroupCommand({
  key: "FACE_CUT",
  label: "Coupe face",
  Icon: IconFaceCut,
  editors: [EDITOR_3D],
  hotkey: {
    key: "c",
    yieldWhen: (state) =>
      Boolean(state.threedEditor?.moveAnnotationMode?.active),
  },
});
