import CleaningServices from "@mui/icons-material/CleaningServices";

import ButtonClean from "./ButtonClean";

// « Nettoyer »: purges the deleted annotations of the current scope — the
// soft-deleted tombstones, the orphan points and the dead mesh paints
// (purgeDeletedAnnotationsService, shared with the « Purger les suppressions »
// button of the 2D editor settings). No selection needed; the Button opens a
// confirmation dialog announcing the counts first (hard delete, not undoable).
export default {
  key: "CLEAN",
  label: "Nettoyer",
  Icon: CleaningServices,
  Button: ButtonClean,
  getState(ctx) {
    if (!ctx.selectedScopeId)
      return { enabled: false, reason: "Sélectionnez un scope" };
    if (ctx.readOnly) return { enabled: false, reason: ctx.readOnlyReason };
    return { enabled: true };
  },
};
