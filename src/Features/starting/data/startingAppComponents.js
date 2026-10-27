// Key components of the editor screen (section « Naviguer dans l'appli »),
// in display order, mirroring LayoutDesktop / SectionViewer. `zones` are the
// data-zone ids of SvgAppSkeleton. The top bar lists its own controls as
// `children`: a child emphasizes itself plus the bar it sits in.
const TOP_BAR_CHILDREN = [
  {
    key: "HOME",
    zone: "home",
    label: () => "Bouton Accueil",
    description: () => "Retour à la page d'accueil.",
  },
  {
    key: "DOCK",
    zone: "dock",
    // Also lights the panel it docks (extraZones).
    extraZones: ["module_panel"],
    label: () => "Ancrage du panneau du module",
    description: () =>
      "Épingle le panneau du module à gauche de l'éditeur ou le libère. Cliquez le bouton dans le squelette pour l'essayer.",
  },
  {
    key: "PROJECT",
    zone: "project",
    label: (v) => `Nom du ${v.projectLowerS}`,
    description: (v) => `Le ${v.projectLowerS} ouvert.`,
  },
  {
    key: "SCOPE",
    zone: "scope",
    label: (v) => `Sélecteur du ${v.scopeS}`,
    description: (v) => `Change de ${v.scopeS} dans le ${v.projectLowerS}.`,
  },
  {
    key: "BASE_MAP",
    zone: "base_map",
    label: () => "Sélecteur du fond de plan",
    description: () => "Change de fond de plan et de version.",
  },
  {
    key: "SAVE",
    zone: "save",
    label: () => "Bouton Enregistrer",
    description: (v) => `Enregistre le ${v.scopeS} (Ctrl + S).`,
  },
];

export const APP_COMPONENTS = [
  {
    key: "TOP_BAR",
    label: () => "Barre supérieure",
    description: (v) =>
      `Navigation et contexte : ${v.projectLowerS}, ${v.scopeS}, fond de plan, enregistrement.`,
    zones: ["top_bar", ...TOP_BAR_CHILDREN.map((c) => c.zone)],
    children: TOP_BAR_CHILDREN.map((child) => ({
      ...child,
      zones: ["top_bar", child.zone, ...(child.extraZones ?? [])],
    })),
  },
  {
    key: "MODULE_BAND",
    label: () => "Bandeau de sélection du module",
    description: () =>
      "Choix du module : Fonds de plan, Dessin, Photos, Viewer…",
    zones: ["module_band"],
  },
  {
    key: "MODULE_PANEL",
    label: () => "Panneau du module",
    description: () =>
      "Le contenu du module sélectionné : listes, modèles, outils de dessin.",
    zones: ["module_panel"],
  },
  {
    key: "EDITOR",
    label: () => "Éditeur 2D / 3D",
    description: () =>
      "La zone de dessin sur le fond de plan, en plan ou en 3D. Le bouton en bas à droite (ou la touche T) bascule la vue : essayez-le.",
    zones: ["editor", "editor_toggle"],
  },
  {
    key: "COMMANDS_TOOLBAR",
    label: () => "Barre de commandes",
    description: () =>
      "Les commandes applicables à la sélection ; ancrée à gauche de l'éditeur par défaut.",
    zones: ["commands_toolbar"],
  },
  {
    key: "ANNOTATIONS_PANEL",
    label: () => "Panneau d'annotations",
    description: () =>
      "Liste flottante des annotations du fond de plan, par liste et par modèle.",
    zones: ["annotations_panel"],
  },
  {
    key: "TOOLS_BAND",
    label: () => "Barre d'outils",
    description: () =>
      "À droite de l'éditeur : propriétés, élévation, capture, export…",
    zones: ["tools_band"],
  },
  {
    key: "PROPERTIES_PANEL",
    label: () => "Panneau de propriétés",
    description: () =>
      "S'ouvre à gauche de la barre d'outils pour modifier la sélection. Cliquez l'outil « Propriétés » dans le squelette (ou appuyez sur I) pour l'ouvrir ou le fermer.",
    zones: ["properties_panel"],
  },
];
