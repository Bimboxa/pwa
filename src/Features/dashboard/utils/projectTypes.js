// Chip colors by project type. Labels are org-specific and come from
// appConfig.strings.project.typeLabels (see ChipProjectType).
export const PROJECT_TYPES = {
  CHANTIER: { key: "CHANTIER", color: "#2563eb" },
  OPPORTUNITE: { key: "OPPORTUNITE", color: "#7c3aed" },
  // canonical free-project type (same value as the push/sync "PROJECT" type)
  PROJECT: { key: "PROJECT", color: "#0f766e" },
};

// unknown/legacy types (incl. the old "PROJET" key) render as PROJECT
export function getProjectTypeProps(type) {
  return PROJECT_TYPES[type] ?? PROJECT_TYPES.PROJECT;
}
