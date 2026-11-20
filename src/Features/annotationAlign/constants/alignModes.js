// Align modes of a multi-selection (PowerPoint-like). The reference is the
// bounding box of the aligned annotations; each annotation is translated
// along ONE axis.
export const ALIGN_LEFT = "ALIGN_LEFT";
export const ALIGN_CENTER_H = "ALIGN_CENTER_H";
export const ALIGN_RIGHT = "ALIGN_RIGHT";
export const ALIGN_TOP = "ALIGN_TOP";
export const ALIGN_MIDDLE = "ALIGN_MIDDLE";
export const ALIGN_BOTTOM = "ALIGN_BOTTOM";

// Display order: the three modes moving along x, then the three along y.
export const ALIGN_MODES = [
  { key: ALIGN_LEFT, label: "Aligner à gauche" },
  { key: ALIGN_CENTER_H, label: "Centrer horizontalement" },
  { key: ALIGN_RIGHT, label: "Aligner à droite" },
  { key: ALIGN_TOP, label: "Aligner en haut" },
  { key: ALIGN_MIDDLE, label: "Centrer verticalement" },
  { key: ALIGN_BOTTOM, label: "Aligner en bas" },
];

export const MIN_ALIGN_TARGETS = 2;
export const ALIGN_TARGETS_REASON =
  "Sélectionnez au moins 2 annotations alignables";
