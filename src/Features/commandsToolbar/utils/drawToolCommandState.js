// Shared getState bricks of the drawing-tool commands (the former TOOL_ITEMS
// rows): the tools are offered where the "Commandes" rows were
// (ctx.showDrawingTools — selectShowDrawingTools), and while a draw or a 3D
// tool mode is armed only the armed command stays enabled (and active), so
// its letter / button toggles it or re-arms it, like the hotkeys' upstream
// rule.

export const DRAWING_TOOLS_UNAVAILABLE_REASON =
  "Commandes de dessin indisponibles dans ce mode";
export const DRAW_IN_PROGRESS_REASON =
  "Un dessin est en cours (Échap pour quitter)";
export const TOOL_IN_PROGRESS_REASON =
  "Un outil est actif (Échap pour quitter)";

// Common gate — returns a disabled state, or null when the tool may be offered.
export function getDrawToolsGate(ctx) {
  if (!ctx.showDrawingTools) {
    return { enabled: false, reason: DRAWING_TOOLS_UNAVAILABLE_REASON };
  }
  return null;
}

// State of a 2D/3D tool group command (DRAWING_TOOLS_BY_TYPE type).
export function getToolGroupState(ctx, toolType) {
  const gate = getDrawToolsGate(ctx);
  if (gate) return gate;
  if (ctx.enabledDrawingMode) {
    const active = ctx.activeToolType === toolType;
    return active
      ? { enabled: true, active: true }
      : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
  }
  if (ctx.activeThreedTool) {
    return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
  }
  return { enabled: true };
}

// State of a threedEditor tool mode command (selectActiveThreedTool keys).
// `activeKeys`: the mode keys the command stands for (Déplacer covers
// MOVE_ANNOTATION and VERTEX_OFFSET).
export function getThreedToolState(ctx, activeKeys) {
  const gate = getDrawToolsGate(ctx);
  if (gate) return gate;
  if (ctx.enabledDrawingMode) {
    return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
  }
  if (ctx.activeThreedTool) {
    const active = activeKeys.includes(ctx.activeThreedTool);
    return active
      ? { enabled: true, active: true }
      : { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
  }
  return { enabled: true };
}
