import JoinInner from "@mui/icons-material/JoinInner";

import ButtonDetectDuplicates from "./ButtonDetectDuplicates";
import { EDITOR_2D } from "../../constants/commandEditors";
import { LOADING_REASON } from "../../utils/selectionCommandState";
import getDuplicateCandidates from "Features/duplicatesDetection/utils/getDuplicateCandidates";

// « Détection des doublons »: finds the lines / strips of the same template
// whose paths overlap (totally or partially) on the main base map. Async run
// (worker), result listed in the duplicates helper of the Dessin panel /
// popper (one row per duplicate, click = select, « Relancer »).
export default {
  key: "DETECT_DUPLICATES",
  label: "Détection des doublons",
  Icon: JoinInner,
  Button: ButtonDetectDuplicates,
  editors: [EDITOR_2D],
  getState(ctx) {
    if (ctx.annotationsLoading)
      return { enabled: false, reason: LOADING_REASON };
    const candidates = getDuplicateCandidates(ctx.annotations, {
      baseMapId: ctx.baseMap?.id,
    });
    if (candidates.length < 2)
      return { enabled: false, reason: "Aucune ligne à comparer" };
    return { enabled: true };
  },
};
