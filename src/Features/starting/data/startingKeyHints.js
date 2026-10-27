// Key hints of the section « Les touches clés », in display order. `keys`
// are rendered as KeyCap chips joined by « + »; `icon` is a mouse gesture
// (ICON_RIGHT_CLICK / ICON_LASSO, resolved by SectionKeyHints) appended
// after the keys, or alone.
export const KEY_HINTS = [
  {
    key: "ESCAPE",
    keys: ["Échap"],
    label: "Quitter",
    hint: "Ferme l'outil, le mode de dessin ou le dialogue en cours.",
  },
  {
    key: "DELETE",
    keys: ["Suppr"],
    label: "Supprimer",
    hint: "Supprime la sélection.",
  },
  {
    key: "SHIFT_CLICK",
    keys: ["Maj", "clic"],
    label: "Sélection multiple",
    hint: "Ajoute l'élément cliqué à la sélection.",
  },
  {
    key: "LASSO",
    keys: ["Maj"],
    icon: "ICON_LASSO",
    label: "Sélection lasso",
    hint: "Maintenez Maj enfoncée et glissez sur l'éditeur pour sélectionner une zone.",
  },
  {
    key: "RIGHT_CLICK",
    icon: "ICON_RIGHT_CLICK",
    label: "Commandes favorites",
    hint: "Le clic droit ouvre vos raccourcis (configurables dans « Raccourcis »).",
  },
  {
    key: "SAVE",
    keys: ["Ctrl", "S"],
    label: "Sauvegarder",
    hint: (v) => `Enregistre le ${v.scopeS}.`,
  },
  {
    key: "UNDO",
    keys: ["Ctrl", "Z"],
    label: "Annuler",
    hint: "Annule la dernière action.",
  },
];
