// Business object type of the phases (businessObjectTypesCatalog).
export const PHASING_TYPE_KEY = "PHASING";

// phasing.newAnnotationPeriodMode: period of a new annotation drawn while ONE
// phase is selected.
export const NEW_ANNOTATION_PERIOD_MODES = {
  // that phase only
  ONLY: "ONLY",
  // that phase and the following ones
  FROM: "FROM",
};

// db.relsPhaseAnnotation `type`.
export const PHASE_REL_TYPES = {
  START: "START",
  END: "END",
  EXCLUDE: "EXCLUDE",
};
