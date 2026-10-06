// Shared wording of the « Déplacer » / « Tourner » tools — same gesture, same
// texts in the 2D editor (annotationTransform) and the 3D one
// (threedAnnotationMove).

export const TRANSFORM_TOOL_LABELS = {
  EXTRUDE: "Extruder",
  MOVE_ANNOTATION: "Déplacer",
  ROTATE_ANNOTATION: "Tourner",
  ISOLATE_FACE: "Isoler une face",
};

export function getMoveToolHint({ carriedCount }) {
  return carriedCount > 0
    ? "Cliquez le point de destination"
    : "Cliquez un point de l'annotation à déplacer";
}

export function getRotateToolHint({ carriedCount, referenceSet }) {
  if (carriedCount === 0)
    return "1/3 — Cliquez le centre de rotation sur l'annotation à tourner";
  if (!referenceSet)
    return "2/3 — Cliquez un point pour fixer l'axe de référence";
  return "3/3 — Tournez ou tapez l'angle, clic ou Entrée pour valider";
}

// 2D only: the 3D move has no ortho lock.
export const MOVE_TOOL_SHORTCUTS_2D = [
  { key: "⇧", label: "Déplacement orthogonal" },
  { key: "Esc", label: "Annuler la saisie / Quitter" },
];

export const MOVE_TOOL_SHORTCUTS = [
  { key: "Esc", label: "Annuler la saisie / Quitter" },
];

export const ROTATE_TOOL_SHORTCUTS = [
  { key: "0-9", label: "Saisir l'angle" },
  { key: "Entrée", label: "Valider la rotation" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Esc", label: "Annuler / Quitter" },
];

export const TRANSFORM_UNSUPPORTED_GRAB_MESSAGE =
  "Sélectionnez un point d'une annotation";
