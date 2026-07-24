// Top-level tabs of the "Banque d'objets" panel.
export const OBJECTS_LIBRARY_TABS = [
  { key: "DRAWING", label: "Dessin" },
  { key: "OBJECT_3D", label: "Objets 3D" },
];

// Sub-category chips shown under the "Dessin" tab. Each key matches an object's
// `tab` value in the manifest. Only DRAWING_2D is populated in v1; the others
// render an "En cours de construction" placeholder.
export const DRAWING_SUBTABS = [
  { key: "DRAWING_2D", label: "2D" },
  { key: "DRAWING_3D", label: "3D" },
  { key: "SYSTEMS", label: "Systèmes" },
];

// Human label for an object's `tab` value (used in the dialog/card "Type").
const OBJECT_TAB_LABELS = {
  DRAWING_2D: "Dessin 2D",
  DRAWING_3D: "Dessin 3D",
  SYSTEMS: "Systèmes",
  OBJECT_3D: "Objets 3D",
};

export function getTabLabel(key) {
  return OBJECT_TAB_LABELS[key] ?? key;
}
