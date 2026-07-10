export const PROJECT_TYPES = {
  CHANTIER: { key: "CHANTIER", label: "Chantier", color: "#2563eb" },
  OPPORTUNITE: { key: "OPPORTUNITE", label: "Opportunité", color: "#7c3aed" },
  PROJET: { key: "PROJET", label: "Projet", color: "#0f766e" },
};

export function getProjectTypeProps(type) {
  return PROJECT_TYPES[type] ?? PROJECT_TYPES.PROJET;
}
