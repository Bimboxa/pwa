// Shared gate of the Comments module commands (ADD_COMMENT,
// ADD_LOCATED_COMMENT): returns the disabled state, or null when the command
// may run.
export function getCommentCommandGate(ctx) {
  if (ctx.viewerKey !== "COMMENTS") {
    return { enabled: false, reason: "Réservé au module Infos" };
  }
  if (ctx.readOnly) return { enabled: false, reason: ctx.readOnlyReason };
  if (!ctx.selectedScopeId) {
    return { enabled: false, reason: "Sélectionnez un plan de repérage" };
  }
  return null;
}
