import IconCleanSegments from "Features/icons/IconCleanSegments";

import ButtonCleanSegments from "./ButtonCleanSegments";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

// « Aligner » (clean segments): aligns two or more POLYLINE / STRIP
// annotations (multi-point polylines are split into 2-pt segments first;
// strips are aligned on their centerline then re-derived).
export default {
  key: "CLEAN_SEGMENTS",
  label: "Aligner",
  Icon: IconCleanSegments,
  Button: ButtonCleanSegments,
  getState(ctx) {
    const gate = getSelectionGate(ctx, { min: 2 });
    if (gate) return gate;
    const targets = getTargets(ctx);
    const ok =
      targets.length >= 2 &&
      targets.every(
        (a) => ["POLYLINE", "STRIP"].includes(a.type) && a.points?.length >= 2
      );
    return ok
      ? { enabled: true }
      : {
          enabled: false,
          reason: "Sélectionnez au moins deux lignes ou bandes",
        };
  },
};
