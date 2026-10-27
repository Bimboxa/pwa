// Key concepts of the app (section « Concepts clés »), in display order.
// `label` and `description` take the vocabulary of getStartingVocabulary so
// the wording follows the org config (Krto / Mission / Dossier…). `zones`
// are the data-zone ids of SvgConceptsDiagram emphasized when the concept is
// highlighted; every other zone of the diagram is dimmed.
const TEMPLATE_ZONES = ["template-courante", "template-releve", "template-ep"];
const ANNOTATION_ZONES = [
  "annotation-rect",
  "annotation-line",
  "annotation-point",
];

export const CONCEPTS = [
  {
    key: "SCOPE",
    label: (v) => v.scopeS,
    description: (v) =>
      v.scopeDescriptionS ??
      `Un ${v.scopeS} est un dossier de plans de repérage de même type, rattaché à un ${v.projectLowerS}.`,
    zones: [
      "scope-spine",
      "scope-pill-a",
      "scope-pill-b",
      "scope-frame",
      "scope-title",
      "link-pill-frame",
    ],
  },
  {
    key: "BASE_MAP",
    label: () => "Fond de plan",
    description: (v) =>
      `L'image d'un plan de niveau ou d'une coupe sur laquelle on dessine, dans un ${v.scopeS}.`,
    zones: ["plan", "plan-label", "plan-thumbs", "box-3d"],
  },
  {
    key: "ANNOTATION",
    label: () => "Annotation",
    description: () =>
      "Une forme dessinée sur un fond de plan : surface, ligne ou point.",
    zones: [...ANNOTATION_ZONES, "box-3d-annotations"],
  },
  {
    key: "TEMPLATE",
    label: () => "Modèle d'annotation",
    description: () =>
      "Le style et l'entrée de légende d'une annotation (« Partie courante », « Relevé », « EP »).",
    zones: [...TEMPLATE_ZONES, ...ANNOTATION_ZONES],
  },
  {
    key: "LISTING",
    label: (v) => `Liste de modèles d'annotation (${v.listingsS})`,
    description: () =>
      "Un groupe de modèles d'annotation, par exemple un procédé.",
    zones: ["listing-panel", "listing-a", "listing-b", ...TEMPLATE_ZONES],
  },
  {
    key: "EXPORT",
    label: () => "Export",
    description: (v) =>
      `Ce que l'on sort d'un ${v.scopeS} : métré, plan de repérage, carnet de plans.`,
    zones: ["export-arrow", "export-metre", "export-plan", "export-carnet"],
  },
  {
    key: "CONFIGURATION",
    label: () => "Configuration",
    description: (v) =>
      `Une liste de modèles d'annotation paramétrée, réutilisable pour créer un ${v.scopeS}.`,
    zones: [
      "config-label",
      "config-bracket",
      "listing-panel",
      "listing-a",
      "listing-b",
    ],
  },
  {
    key: "BASE_MAP_FOLDER",
    label: () => "Dossier de fonds de plan",
    description: (v) =>
      `Les fonds de plan du ${v.projectLowerS} (plans de niveau, coupes), partagés entre les ${v.scopePluralS}.`,
    zones: [
      "folder-frame",
      "folder-title",
      "folder-levels",
      "folder-sections",
      "link-folder-plan",
      "link-project-folder",
    ],
  },
  {
    key: "PROJECT",
    label: (v) =>
      v.projectTypesS ? `${v.projectS} (${v.projectTypesS})` : v.projectS,
    description: (v) =>
      `Le périmètre racine : il regroupe les ${v.scopePluralS} et le dossier de fonds de plan.`,
    // The project emphasizes what hangs off it: its scopes and its base
    // maps folder.
    zones: [
      "project-line",
      "project-label",
      "link-project-spine",
      "link-project-folder",
      "scope-spine",
      "scope-pill-a",
      "scope-pill-b",
      "folder-frame",
      "folder-title",
      "folder-levels",
      "folder-sections",
    ],
  },
];
