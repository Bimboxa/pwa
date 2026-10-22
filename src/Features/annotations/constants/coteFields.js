// Cote-specific style fields shared by COTE and RULER (dimension chain):
// the template popover (FieldAnnotationTemplateCote — also the subset its
// padlock locks and "Réinit." restores) and the per-annotation section
// (SectionAnnotationCote) edit the same list.
export const COTE_FIELDS = [
  "unit",
  "extensionOffset",
  "extensionOffsetUnit",
  "decimals",
  "fontSize",
  "showUnitLabel",
  // RULER only (see showTotalOption / showLabelOption), but kept in the
  // lock/reset group so the padlock and "Réinit." stay consistent with what
  // the popover shows.
  "showTotalCote",
  "showRulerLabel",
  // 3D: values in cards (true) or bare with a white halo (false).
  "showValueCard",
];
