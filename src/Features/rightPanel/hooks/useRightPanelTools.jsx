import { useSelector } from "react-redux";

import {
  Edit,
  Room,
  CenterFocusStrong,
  Tune,
  AutoFixHigh,
  Height,
  Upload,
  AutoAwesome,
  Settings,
  Category,
  Chat,
  Image,
  FolderOpen,
} from "@mui/icons-material";

import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import IconExportPlan from "Features/icons/IconExportPlan";
import {
  selectDisabledToolKeys,
  selectDisabledToolKeysByModule,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

// Tools that can never be disabled from the Configuration dialog:
// SELECTION_PROPERTIES keeps the "every module shows at least Propriétés"
// injection invariant, SETTINGS is the escape hatch to the editor settings.
export const LOCKED_TOOL_KEYS = new Set(["SELECTION_PROPERTIES", "SETTINGS"]);

// Builds the right-panel tool list (the vertical band on the right). MODULE-driven:
// filtered by appConfig.features.tools, by the current module (selectedViewerKey)
// and by the per-scope activation (db.scopeConfigs: root + per-module disabled
// tools), never by the editor (2D/3D) displayed inside the module.
//
// Single source of truth shared by the band renderer (VerticalMenuRightPanel) and the
// keyboard-shortcut hook (useRightPanelToolHotkeys): both agree on which tools — and
// therefore which `hotkey` letters — are currently available. A tool absent from the
// current module (or from appConfig.features.tools) never binds its letter.
//
// Returns { menuItems, toolsByKey, catalog }:
//   - menuItems: the filtered, ordered list rendered in the band (hotkeys included).
//   - toolsByKey: raw metadata for EVERY known tool (unfiltered, `scopeDisabled`
//     flagged), used by the auto-close effect to look up a still-open tool's
//     `viewers` even after it left the list.
//   - catalog: every configurable tool for the Configuration dialog — the
//     org-allowlist tools (order preserved, SELECTION_PROPERTIES force-included)
//     plus the contextual ones, unfiltered by module or scopeConfig, each
//     annotated with `locked`.
export default function useRightPanelTools() {
  const appConfig = useAppConfig();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const disabledToolKeysByModule = useSelector(selectDisabledToolKeysByModule);

  // const - tools without a `viewers` field are available in every viewer

  const toolsMap = {
    SELECTION_PROPERTIES: {
      label: "Propriétés",
      icon: <Tune />,
      // Plain "I" — free in the tool letter namespace: the paste-mode flip
      // ("I") is disjoint (the hotkey hook is inert while a paste is active)
      // and modules switch on Ctrl+I.
      hotkey: "I",
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

    PRINT: {
      label: "Export",
      icon: <IconExportPlan />,
      viewers: ["MAP", "THREED", "MESHES"],
    },
    ELEVATION: {
      label: "Élévation",
      icon: <Height />,
      // Plain "E" — the hollow-out ("Évider") shortcut keeps priority while a
      // POLYGON is selected on the 2D map (guard in useRightPanelToolHotkeys).
      hotkey: "E",
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
      // `group: "bottom"` anchors the tool in the bottom-aligned section of
      // the band (rendered by VerticalMenuV2).
      group: "bottom",
    },
    RESOURCES: {
      label: "Ressources",
      icon: <FolderOpen />,
      // Project-level resource files (PDF, DWG, images…): available in every
      // module. Bottom section, above the contextual "Réglages" (contextual
      // bottom tools are always appended last).
      group: "bottom",
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
      // Former advanced-mode tool — kept declared but disabled by default.
      disabled: true,
    },
  };

  // const - contextual items, not driven by appConfig.features.tools; each one
  // is inserted at its own slot while its viewer is active (see below).

  const contextualTools = [
    // Settings of the editor actually displayed (3D view settings — the
    // former "Vue 3D" tool — when a 3D editor is active, 2D editor settings
    // otherwise). No `viewers` constraint: available in every module.
    {
      key: "SETTINGS",
      label: "Réglages",
      icon: <Settings />,
      group: "bottom",
    },
    // Global capture: same frame as the POV framing (panel-independent). The
    // only capture entry point since the Export tool dropped its "Export
    // rapide" card. Every module with a 2D/3D editor — PORTFOLIO and LISTING
    // have no capture host. Plain "V" (smart-detect's in-draw "v" is disjoint:
    // the hotkey hook is inert while drawing).
    {
      key: "CAPTURE",
      label: "Capture",
      icon: <CenterFocusStrong />,
      hotkey: "V",
      viewers: [
        "MAP",
        "BASE_MAPS",
        "ZONES",
        "POINT_OF_VIEW",
        "THREED",
        "MESHES",
      ],
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

  // Per-scope activation (db.scopeConfigs): a root-disabled tool is gone in
  // every module; a per-module disabled tool only in that module. Locked
  // tools ignore both lists.
  const disabledForModule = disabledToolKeysByModule[selectedViewerKey] ?? [];
  const isScopeDisabled = (key) =>
    !LOCKED_TOOL_KEYS.has(key) &&
    (disabledToolKeys.includes(key) || disabledForModule.includes(key));

  // Raw lookup for every known tool (unfiltered) — the auto-close effect needs a
  // still-open tool's `viewers` and `scopeDisabled` even once it dropped out of
  // `menuItems`.
  const toolsByKey = {};
  Object.entries(toolsMap).forEach(([key, tool]) => {
    toolsByKey[key] = { ...tool, key, scopeDisabled: isScopeDisabled(key) };
  });
  contextualTools.forEach((t) => {
    toolsByKey[t.key] = { ...t, scopeDisabled: isScopeDisabled(t.key) };
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
  menuItems = menuItems.filter((t) => !isScopeDisabled(t.key));

  // Every module shows at least the "Propriétés" tool, whichever editor is
  // displayed — guaranteed here so no appConfig or filter can drop it.
  if (!menuItems.some((t) => t.key === "SELECTION_PROPERTIES")) {
    menuItems.unshift({
      ...toolsMap.SELECTION_PROPERTIES,
      key: "SELECTION_PROPERTIES",
      enabled: true,
    });
  }

  // "Bibliothèque" is hoisted near the top of the band, whatever order
  // appConfig.features.tools declares. It is a MAP-only tool, so this hoist
  // only ever affects the dessin module.
  const objectsLibraryIndex = menuItems.findIndex(
    (t) => t.key === "OBJECTS_LIBRARY"
  );
  if (objectsLibraryIndex > 0) {
    const [objectsLibraryTool] = menuItems.splice(objectsLibraryIndex, 1);
    menuItems.unshift(objectsLibraryTool);
  }

  // "Propriétés" sits at the very top of the band, above everything else
  // (including the "Bibliothèque" hoist just above).
  const propertiesHoistIndex = menuItems.findIndex(
    (t) => t.key === "SELECTION_PROPERTIES"
  );
  if (propertiesHoistIndex > 0) {
    const [propertiesTool] = menuItems.splice(propertiesHoistIndex, 1);
    menuItems.unshift(propertiesTool);
  }

  const activeContextualTools = contextualTools
    .filter((t) => !t.viewers || t.viewers.includes(selectedViewerKey))
    .filter((t) => !isScopeDisabled(t.key));

  // Each contextual tool has its own slot:
  // - bottom-group tools ("Réglages") are appended last so they close the
  //   bottom section, below the appConfig-driven bottom tools;
  // - "Capture" sits right above "Export" (capture output is a form of
  //   export); modules without PRINT fall back to the "Propriétés" slot;
  // - the others land right below "Propriétés" (historical position).
  const bottomTools = [];
  const belowPropertiesTools = [];
  activeContextualTools.forEach((tool) => {
    if (tool.group === "bottom") {
      bottomTools.push(tool);
      return;
    }
    if (tool.key === "CAPTURE") {
      const printIndex = menuItems.findIndex((t) => t.key === "PRINT");
      if (printIndex !== -1) {
        menuItems.splice(printIndex, 0, tool);
        return;
      }
    }
    belowPropertiesTools.push(tool);
  });
  if (belowPropertiesTools.length > 0) {
    const propertiesIndex = menuItems.findIndex(
      (t) => t.key === "SELECTION_PROPERTIES"
    );
    menuItems.splice(propertiesIndex + 1, 0, ...belowPropertiesTools);
  }
  menuItems.push(...bottomTools);

  // catalog — see the hook doc comment. Mirrors the menu construction rules
  // (org allowlist order, SELECTION_PROPERTIES force-included, `disabled`
  // dropped) without the module / scopeConfig filters.
  const catalog = toolsKeys
    .map((key) => (toolsMap[key] ? { ...toolsMap[key], key } : null))
    .filter(Boolean)
    .filter((t) => !t.disabled);
  if (!catalog.some((t) => t.key === "SELECTION_PROPERTIES")) {
    catalog.unshift({
      ...toolsMap.SELECTION_PROPERTIES,
      key: "SELECTION_PROPERTIES",
    });
  }
  catalog.push(...contextualTools.filter((t) => !t.disabled));
  const catalogWithLock = catalog.map((t) => ({
    ...t,
    locked: LOCKED_TOOL_KEYS.has(t.key),
  }));

  return { menuItems, toolsByKey, catalog: catalogWithLock };
}
