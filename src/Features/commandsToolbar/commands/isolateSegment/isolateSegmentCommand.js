import IconIsolateSegment from "Features/icons/IconIsolateSegment";

import isOpeningAnnotation, {
  getOpeningType,
} from "Features/annotations/utils/isOpeningAnnotation";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Isoler un segment » (S, 2D — Features/isolateSegment). The letter stays
// the door-side flip of a single selected DOOR opening (InteractionLayer's
// own "s" handler): the hotkey yields to it.
export default createToolGroupCommand({
  key: "ISOLATE_SEGMENT",
  label: "Isoler un segment",
  Icon: IconIsolateSegment,
  editors: [EDITOR_2D],
  hotkey: {
    key: "s",
    plainOnly: true,
    yieldWhen: (state, ctx) =>
      isOpeningAnnotation(ctx.selectedAnnotation) &&
      getOpeningType(ctx.selectedAnnotation) === "DOOR",
  },
});
