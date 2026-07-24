import { useSelector } from "react-redux";

import {
  Edit,
  Room,
  CameraAlt,
  Tune,
  AutoFixHigh,
  Print,
  Height,
  Upload,
  AutoAwesome,
  Settings,
  Category,
  Chat,
  Image,
} from "@mui/icons-material";

import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

// Builds the right-panel tool list (the vertical band on the right). MODULE-driven:
// filtered by appConfig.features.tools and by the current module (selectedViewerKey),
// never by the editor (2D/3D) displayed inside the module.
//
// Single source of truth shared by the band renderer (VerticalMenuRightPanel) and the
// keyboard-shortcut hook (useRightPanelToolHotkeys): both agree on which tools — and
// therefore which `hotkey` letters — are currently available. A tool absent from the
// current module (or from appConfig.features.tools) never binds its letter.
//
// Returns { menuItems, toolsByKey }:
//   - menuItems: the filtered, ordered list rendered in the band (hotkeys included).
//   - toolsByKey: raw metadata for EVERY known tool (unfiltered), used by the auto-close
//     effect to look up a still-open tool's `viewers` even after it left the list.
export default function useRightPanelTools() {
  const appConfig = useAppConfig();
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // const - tools without a `viewers` field are available in every viewer

  const toolsMap = {
    SELECTION_PROPERTIES: {
      label: "Propriétés",
      icon: <Tune />,
    },

    ANNOTATIONS_AUTO: {
      label: "Dessin auto",
      icon: <AutoFixHigh />,
      viewers: ["MAP"],
    },
    ENTITY: {
      label: "Édition",
      icon: <Edit />,
    },
    ENTITY_ZONES: {
      label: "Localisation",
      icon: <Room />,
    },

    MASTER_PROJECT_PICTURES: {
      label: appConfig?.features?.masterProjectPictures?.title,
      icon: <CameraAlt />,
      viewers: ["MAP", "THREED", "MESHES"],
    },
    PRINT: {
      label: "Export",
      icon: <Print />,
      viewers: ["MAP", "THREED", "MESHES"],
    },
    ELEVATION: {
      label: "Élévation",
      icon: <Height />,
      // Global shortcut: "V" is already the POV module (useViewers), and "E" hollows a
      // selected polygon — "N" is free in every global handler.
      hotkey: "N",
      // In BASE_MAPS the panel has a dedicated role: browse the vertical
      // baseMaps and locate them against a plan view.
      viewers: ["MAP", "THREED", "MESHES", "BASE_MAPS"],
    },
    CHAT: {
      label: "Chat",
      icon: <Chat />,
    },
    IMPORT_ANNOTATIONS: {
      label: "Importer annotations",
      icon: <Upload />,
      viewers: ["MAP"],
    },
    OBJECTS_LIBRARY: {
      label: "Bibliothèque",
      icon: <Category />,
      // Free outside a draw: STRIP/CUT_STRIP only own "B" while drawing, and the
      // hotkey hook is inert then (enabledDrawingMode guard).
      hotkey: "B",
      viewers: ["MAP"],
    },
    LOCAL_LLM: {
      label: "IA locale",
      icon: <AutoAwesome />,
      disabled: !advancedLayout,
    },
  };

  // const - contextual items, not driven by appConfig.features.tools; inserted
  // right below "Propriétés" while their viewer is active.

  const contextualTools = [
    // Settings of the editor actually displayed (3D view settings — the
    // former "Vue 3D" tool — when a 3D editor is active, 2D editor settings
    // otherwise). No `viewers` constraint: available in every module.
    {
      key: "SETTINGS",
      label: "Réglages",
      icon: <Settings />,
    },
    {
      key: "BASE_MAP_TRANSFORMS",
      label: "Transfo.",
      // image with a small AI-enhancement star on its top-right corner
      icon: (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <Image />
          <AutoAwesome
            sx={{ position: "absolute", top: -5, right: -6, fontSize: 12 }}
          />
        </Box>
      ),
      viewers: ["BASE_MAPS"],
    },
  ];

  // Raw lookup for every known tool (unfiltered) — the auto-close effect needs a
  // still-open tool's `viewers` even once it dropped out of `menuItems`.
  const toolsByKey = { ...toolsMap };
  contextualTools.forEach((t) => {
    toolsByKey[t.key] = t;
  });

  // helper

  const toolsKeys = appConfig?.features?.tools ?? [];
  let menuItems = toolsKeys
    .map((key) => ({ ...toolsMap[key], key, enabled: Boolean(toolsMap[key]) }))
    .filter((t) => t.enabled);

  // filter — the tools list is MODULE-driven (selectedViewerKey is the
  // module key): it never changes with the editor (2D/3D) displayed inside
  // the module.
  menuItems = menuItems.filter((t) => !t.disabled);
  menuItems = menuItems.filter(
    (t) => !t.viewers || t.viewers.includes(selectedViewerKey)
  );

  // Every module shows at least the "Propriétés" tool, whichever editor is
  // displayed — guaranteed here so no appConfig or filter can drop it.
  if (!menuItems.some((t) => t.key === "SELECTION_PROPERTIES")) {
    menuItems.unshift({
      ...toolsMap.SELECTION_PROPERTIES,
      key: "SELECTION_PROPERTIES",
      enabled: true,
    });
  }

  const activeContextualTools = contextualTools.filter(
    (t) => !t.viewers || t.viewers.includes(selectedViewerKey)
  );
  if (activeContextualTools.length > 0) {
    const propertiesIndex = menuItems.findIndex(
      (t) => t.key === "SELECTION_PROPERTIES"
    );
    menuItems.splice(propertiesIndex + 1, 0, ...activeContextualTools);
  }

  return { menuItems, toolsByKey };
}
