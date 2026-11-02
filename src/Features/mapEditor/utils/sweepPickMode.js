// « Extruder le long d'une ligne » pick mode: armed with the PROFILE
// annotation (the selected polyline), the next clicked annotation is the
// GUIDE — one-shot, the mode exits once the swept annotation is created (or
// on Escape / an empty click). Code asking "is the sweep pick active?" —
// hotkey guards, the popper priority chain, the editors' click handlers —
// reads this selector.

export const selectSweepPickAnnotationId = (s) =>
  s.mapEditor.sweepProfileAnnotationId;
