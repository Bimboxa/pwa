import JoinInner from "@mui/icons-material/JoinInner";

import ButtonDetectDuplicates from "./ButtonDetectDuplicates";
import { LOADING_REASON } from "../../utils/selectionCommandState";
import getDuplicateCandidates from "Features/duplicatesDetection/utils/getDuplicateCandidates";

// « Détection des doublons »: finds the lines / strips (shared length) and
// polygons (intersection area) of the same template that overlap, totally
// or partially, on the main base map — from the 2D editor or the Dessin
// module's 3D editor (same context, same main base map). Async run (worker),
// result listed in the duplicates helper of the Dessin panel / popper (one
// row per duplicate, click = select, « Relancer »).
export default {
  key: "DETECT_DUPLICATES",
  label: "Détection des doublons",
  Icon: JoinInner,
  Button: ButtonDetectDuplicates,
  getState(ctx) {
    if (ctx.annotationsLoading)
      return { enabled: false, reason: LOADING_REASON };
    const candidates = getDuplicateCandidates(ctx.annotations, {
      baseMapId: ctx.baseMap?.id,
    });
    if (candidates.length < 2)
      return { enabled: false, reason: "Aucune annotation à comparer" };
    return { enabled: true };
  },
};
