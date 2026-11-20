import { DRAW_IN_PROGRESS_REASON } from "./drawToolCommandState";

// Shared gate of the Infos commands (ADD_COMMENT, ADD_LOCATED_COMMENT):
// returns the disabled state, or null when the command may run.
// Offered in the Infos module itself and, while that module is enabled in
// the scope (ctx.commentsModuleEnabled), in every other module carrying the
// commands toolbar — an info can be written from where the work happens.
export function getCommentCommandGate(ctx) {
  if (ctx.viewerKey !== "COMMENTS" && !ctx.commentsModuleEnabled) {
    return { enabled: false, reason: "Module Infos désactivé" };
  }
  if (ctx.readOnly) return { enabled: false, reason: ctx.readOnlyReason };
  if (!ctx.selectedScopeId) {
    return { enabled: false, reason: "Sélectionnez un plan de repérage" };
  }
  if (ctx.enabledDrawingMode) {
    return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
  }
  return null;
}
