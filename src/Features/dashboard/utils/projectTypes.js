export const PROJECT_TYPES = {
  CHANTIER: { key: "CHANTIER", label: "Chantier", color: "#2563eb" },
  OPPORTUNITE: { key: "OPPORTUNITE", label: "Opportunité", color: "#7c3aed" },
  // canonical free-project type (same value as the push/sync "PROJECT" type)
  PROJECT: { key: "PROJECT", label: "Projet", color: "#0f766e" },
};

// unknown/legacy types (incl. the old "PROJET" key) still render as "Projet"
export function getProjectTypeProps(type) {
  return PROJECT_TYPES[type] ?? PROJECT_TYPES.PROJECT;
}
