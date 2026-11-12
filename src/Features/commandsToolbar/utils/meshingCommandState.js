import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "./drawToolCommandState";

// Shared `getState` guards of the meshing commands (3D, Maillage module —
// ADD_MESH, CREATE_MESHES, NUMBER_MESHES): returns the disabled state, or
// null when the command is available.
export function getMeshingCommandDisabledState(ctx) {
  if (ctx.viewerKey !== "MESHES") {
    return { enabled: false, reason: "Réservé au module Maillage" };
  }
  if (ctx.viewerMode) {
    return { enabled: false, reason: ctx.readOnlyReason };
  }
  if (!ctx.selectedScopeId) {
    return { enabled: false, reason: "Sélectionnez un plan de repérage" };
  }
  if (ctx.enabledDrawingMode) {
    return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
  }
  // Meshing mode is off while another 3D mode owns the pointer (frame
  // placement, base map move / rotation).
  if (!ctx.meshingTool) {
    return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
  }
  return null;
}

// State of a command arming one tool of the meshing mode (ctx.meshingTool).
export function getMeshingToolCommandState(ctx, tool) {
  return (
    getMeshingCommandDisabledState(ctx) ?? {
      enabled: true,
      active: ctx.meshingTool === tool,
    }
  );
}
