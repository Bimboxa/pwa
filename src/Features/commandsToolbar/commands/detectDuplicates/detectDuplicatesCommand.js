import JoinInner from "@mui/icons-material/JoinInner";

import ButtonDetectDuplicates from "./ButtonDetectDuplicates";
import { LOADING_REASON } from "../../utils/selectionCommandState";
import getDuplicateCandidates from "Features/duplicatesDetection/utils/getDuplicateCandidates";
import getCutOverlapCandidates from "Features/duplicatesDetection/utils/getCutOverlapCandidates";

// « Détection des doublons »: finds the lines / strips (shared length) and
// polygons (intersection area) of the same template that overlap, totally
// or partially, on the main base map — from the 2D editor or the Dessin
// module's 3D editor (same context, same main base map). Async run (worker),
// result listed in the duplicates helper of the Dessin panel / popper (one
// row per duplicate, click = select, « Relancer »). The same run lists the
// polygons whose own openings (cuts) overlap each other.
export default {
  key: "DETECT_DUPLICATES",
  usesSelection: false,
  label: "Détection des doublons",
  Icon: JoinInner,
  Button: ButtonDetectDuplicates,
  getState(ctx) {
    if (ctx.annotationsLoading)
      return { enabled: false, reason: LOADING_REASON };
    const candidates = getDuplicateCandidates(ctx.annotations, {
      baseMapId: ctx.baseMap?.id,
    });
    const hasCutCandidates =
      getCutOverlapCandidates(ctx.annotations, { baseMapId: ctx.baseMap?.id })
        .length > 0;
    if (candidates.length < 2 && !hasCutCandidates)
      return { enabled: false, reason: "Aucune annotation à comparer" };
    return { enabled: true };
  },
};
