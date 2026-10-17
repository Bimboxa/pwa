// Shared getState bricks of the selection commands (one or several selected
// annotations). `ctx.selectedAnnotations` are the resolved annotations of the
// selection; `isMesh3d` ones are excluded from the geometry tools (their 2D
// polygon is the plan projection of a stored 3D mesh).

export const SELECT_ONE_REASON = "Sélectionnez une annotation";
export const SELECT_SOME_REASON = "Sélectionnez une ou plusieurs annotations";
export const LOADING_REASON = "Chargement des annotations…";
export const MESH3D_REASON = "Indisponible sur une maille 3D";

function disabled(reason) {
  return { enabled: false, reason };
}

// Common gate of every selection command: a selection resolved to
// annotations, editable by the user. Returns a disabled state or null.
export function getSelectionGate(ctx, { min = 1 } = {}) {
  if (ctx.annotationsLoading) return disabled(LOADING_REASON);
  if (ctx.selectedAnnotations.length < min) {
    return disabled(min > 1 ? SELECT_SOME_REASON : SELECT_ONE_REASON);
  }
  if (!ctx.selectionEditable) return disabled(ctx.readOnlyReason);
  return null;
}

// Exactly one selected annotation of one of `types`, not a 3D mesh.
export function getSingleAnnotationState(ctx, types, typesReason) {
  const gate = getSelectionGate(ctx);
  if (gate) return gate;
  if (ctx.selectedAnnotations.length !== 1) return disabled(SELECT_ONE_REASON);
  const a = ctx.selectedAnnotation;
  if (!a) return disabled(SELECT_ONE_REASON);
  if (a.isMesh3d) return disabled(MESH3D_REASON);
  if (types && !types.includes(a.type)) return disabled(typesReason);
  return { enabled: true };
}

// Targets of a 1..n command: the selected annotations of `types` (3D meshes
// excluded).
export function getTargets(ctx, types) {
  return ctx.selectedAnnotations.filter(
    (a) => !a.isMesh3d && (!types || types.includes(a.type))
  );
}

// At least `min` targets of `types` in the selection.
export function getTargetsState(ctx, types, typesReason, { min = 1 } = {}) {
  const gate = getSelectionGate(ctx);
  if (gate) return gate;
  const targets = getTargets(ctx, types);
  if (targets.length < min) return disabled(typesReason);
  return { enabled: true };
}
