// Editors a command can be enabled in. `ctx.editor` of useCommandsContext is
// one of these; a command whose `editors` does not include it is disabled
// with a fixed reason (never hidden — the toolbar order stays stable).
export const EDITOR_2D = "2D";
export const EDITOR_3D = "3D";
export const ALL_EDITORS = [EDITOR_2D, EDITOR_3D];

export const UNAVAILABLE_IN_EDITOR_REASON = {
  [EDITOR_2D]: "Indisponible dans l'éditeur 2D",
  [EDITOR_3D]: "Indisponible dans l'éditeur 3D",
};
