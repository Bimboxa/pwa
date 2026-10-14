// Shared wording of the « Déplacer » / « Tourner » tools — same gesture, same
// texts in the 2D editor (annotationTransform) and the 3D one
// (threedAnnotationMove).

export const TRANSFORM_TOOL_LABELS = {
  EXTRUDE: "Extruder",
  MOVE_ANNOTATION: "Déplacer",
  ROTATE_ANNOTATION: "Tourner",
  ISOLATE_FACE: "Isoler une face",
  MERGE_FACES: "Fusionner des faces",
};

// copyCount: the `*N` of the buffer — armed (nothing grabbed yet): the
// buffer the next grab will pick up; carrying: the pending copies.
// repeat: « Recommencer à chaque clic » — copies: the grab survives each
// click; no copies: the moved annotations are grabbed again at the
// destination.
export function getMoveToolHint({
  carriedCount,
  copyCount = 0,
  repeat = false,
}) {
  if (carriedCount === 0) {
    if (copyCount > 0)
      return `Cliquez un point de l'annotation à copier (×${copyCount})`;
    return "Cliquez un point de l'annotation à déplacer";
  }
  if (copyCount > 0) {
    const base = `Cliquez la destination de la 1re copie (×${copyCount}, l'originale reste en place)`;
    return repeat ? `${base} — recommence à chaque clic` : base;
  }
  if (repeat)
    return "Cliquez le point de destination — l'annotation reste saisie pour le déplacement suivant";
  return "Cliquez le point de destination";
}

// « Recommencer à chaque clic » / « Copier » rows of the move helper
// (SectionMoveRepeatOptions), 2D and 3D.
export const MOVE_REPEAT_LABEL = "Recommencer à chaque clic";
export const MOVE_REPEAT_HINT =
  "Après le clic, la saisie continue : une copie de plus par clic, ou l'annotation reste saisie à sa nouvelle place";
export const MOVE_COPY_BUTTON_LABEL = "Copier";
export const MOVE_COPY_BUTTON_HINT =
  "Une copie par clic (×1, l'originale reste en place) — coche « Recommencer à chaque clic »";

export function getRotateToolHint({
  carriedCount,
  referenceSet,
  copyCount = 0,
}) {
  if (carriedCount === 0)
    return "1/3 — Cliquez le centre de rotation : un point de l'annotation, ou n'importe où si les annotations à tourner sont sélectionnées";
  if (!referenceSet)
    return "2/3 — Cliquez un point pour fixer l'axe de référence";
  if (copyCount > 0)
    return `3/3 — Tournez ou tapez l'angle de la 1re copie (×${copyCount}, l'originale reste en place)`;
  return "3/3 — Tournez ou tapez l'angle, clic ou Entrée pour valider";
}

// Same keys in 2D (image axes) and 3D (user axes X / Y / Z of the gizmo).
// The typed distance / copies keys live in the « Distance - Copies
// multiples » card (SectionTypedConstraint).
export const MOVE_TOOL_SHORTCUTS = [
  { key: "⇧", label: "Déplacement orthogonal" },
  { key: "Esc", label: "Annuler la saisie / Quitter" },
];

export const MULTI_COPY_UNSUPPORTED_MESSAGE =
  "La copie multiple ne s'applique pas à un axe de révolution";

// The typed angle / copies keys live in the « Angle - Copies multiples »
// card (SectionTypedConstraint).
export const ROTATE_TOOL_SHORTCUTS = [
  { key: "Entrée", label: "Valider la rotation" },
  { key: "Esc", label: "Annuler / Quitter" },
];

export const TRANSFORM_UNSUPPORTED_GRAB_MESSAGE =
  "Sélectionnez un point d'une annotation";

// Grab on an annotation whose type the tool does not transform (2D: see
// annotationTransform/utils/transform2dTypes).
export function getTransformUnsupportedTypeMessage(kind) {
  return kind === "ROTATE"
    ? "Ce type d'annotation ne peut pas être tourné ici"
    : "Ce type d'annotation ne peut pas être déplacé ici";
}

// ROTATE 1/3, free click (no annotation point) without a selection.
export const ROTATE_FREE_PIVOT_NO_SELECTION_MESSAGE =
  "Sélectionnez les annotations à tourner, ou cliquez un point de l'annotation";
