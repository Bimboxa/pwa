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
  Image,
  FolderOpen,
  CloudSync,
  SmartToy,
  School,
} from "@mui/icons-material";

import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import IconCatStarEyes from "Features/icons/IconCatStarEyes";
import IconExportPlan from "Features/icons/IconExportPlan";
import {
  selectDisabledToolKeys,
  selectDisabledToolKeysByModule,
  selectSelectedScopeTutorial,
  selectToolOrder,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

import sortToolsByOrder from "../utils/sortToolsByOrder";

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
//   - menuItems: the filtered, ordered list rendered in the band (hotkeys
//     included). Both lists end on sortToolsByOrder, so the band and the
//     Configuration dialog agree on the per-scope order (scopeConfigs.toolOrder).
//   - toolsByKey: raw metadata for EVERY known tool (unfiltered, `scopeDisabled`
//     flagged), used by the auto-close effect to look up a still-open tool's
//     `viewers` even after it left the list.
//   - catalog: every configurable tool for the Configuration dialog — the
//     org-allowlist tools (SELECTION_PROPERTIES force-included) plus the
//     contextual ones, unfiltered by module or scopeConfig, in the per-scope
//     band order, each annotated with `locked`.
// "Tutoriel" then "Chat" close the appConfig-driven bottom tools, whatever
// rank appConfig.features.tools gives them: the contextual bottom tools
// ("Réglages") are appended after them, so Chat sits right above Réglages
// and the tutorial right above Chat.
const LAST_BOTTOM_TOOL_KEYS = ["TUTORIAL", "CHAT"];

function moveToolsLast(tools, keys = LAST_BOTTOM_TOOL_KEYS) {
  const moved = keys
    .map((key) => tools.find((t) => t.key === key))
    .filter(Boolean);
  if (moved.length === 0) return tools;
  return [...tools.filter((t) => !keys.includes(t.key)), ...moved];
}

// Invariant applied after the per-scope order: "Tutoriel" sits right above
// "Chat" (or, without Chat, right above the first contextual bottom tool). A
// scopeConfigs.toolOrder saved before the tool existed ranks it as unknown
// (after "Réglages"); bottom tools are not reorderable in the Configuration
// dialog, so pinning it here never fights a user choice.
function placeTutorialAboveChat(tools) {
  const tutorial = tools.find((t) => t.key === "TUTORIAL");
  if (!tutorial) return tools;
  const rest = tools.filter((t) => t.key !== "TUTORIAL");
  let anchorIndex = rest.findIndex((t) => t.key === "CHAT");
  if (anchorIndex === -1) {
    anchorIndex = rest.findIndex(
      (t) => t.group === "bottom" && t.contextual === true
    );
  }
  if (anchorIndex === -1) return [...rest, tutorial];
  rest.splice(anchorIndex, 0, tutorial);
  return rest;
}

export default function useRightPanelTools() {
  const appConfig = useAppConfig();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const disabledToolKeysByModule = useSelector(selectDisabledToolKeysByModule);
  const toolOrder = useSelector(selectToolOrder);
  const hasTutorial = Boolean(useSelector(selectSelectedScopeTutorial));

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
      // PORTFOLIO: hosts the portfolio PDF download (SectionPortfolioPdfExport).
      viewers: ["MAP", "THREED", "MESHES", "PORTFOLIO"],
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
    TUTORIAL: {
      label: "Tutoriel",
      icon: <School />,
      // Step-by-step guide of the scope's Krto configuration
      // (Data/<org>/configurations/tutorials/<key>.md). Every module.
      // Bottom section, right above "Chat" (see moveToolsLast /
      // placeTutorialAboveChat below).
      group: "bottom",
      // Plain "H" — free outside a draw: the height field capture ("h")
      // only exists while drawing, and the hotkey hook is inert then.
      hotkey: "H",
      // Hard gate (band AND scope-config catalog): nothing to show or to
      // configure when the selected scope's configuration has no tutorial.
      disabled: !hasTutorial,
    },
    CHAT: {
      label: "Chat",
      icon: <IconCatStarEyes />,
      // Assistant chat: available in every module. Bottom section, right
      // above the contextual "Réglages" (see moveChatLast below).
      group: "bottom",
      // Free outside a draw / paste: the Arc tool and the smart-detect only
      // own "A" while drawing or pasting, and the hotkey hook is inert then.
      hotkey: "A",
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
    NOTES_APP_SYNC: {
      label: "Sync",
      icon: <CloudSync />,
      // Scope-level notes-app (Krnet) data integration: available in every
      // module. Bottom section, above the contextual "Réglages".
      group: "bottom",
      // Hard org gate, on top of the features.tools allowlist: hidden
      // everywhere (band AND scope-config catalog) unless the org enables
      // the integration. Off by default; only appConfig_lei turns it on.
      disabled: appConfig?.features?.notesApp?.enabled !== true,
    },
    ASSISTANT_RELAY: {
      label: "Assistant IA",
      icon: <SmartToy />,
      viewers: ["MAP"],
      // ChatGPT relay (reperage-mcp): publish the current base map, import the
      // detected annotations. Bottom section, above the contextual "Réglages".
      group: "bottom",
      // Same hard org gate as NOTES_APP_SYNC: hidden unless the org enables
      // the relay in appConfig.features.assistantRelay.
      disabled: appConfig?.features?.assistantRelay?.enabled !== true,
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
      contextual: true,
    },
    // Global capture: same frame as the POV framing (panel-independent). The
    // only capture entry point since the Export tool dropped its "Export
    // rapide" card. Every module with a 2D/3D editor — PORTFOLIO and SCOPE
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
  menuItems = moveToolsLast(menuItems);
  menuItems.push(...bottomTools);

  // Per-scope order (Configuration > Modules & outils), applied last so it
  // wins over the default slots above — including the "Bibliothèque" hoist,
  // which only survives while the scope stores no explicit order. The
  // bottom-anchored tools keep their own band section whatever their rank
  // (VerticalMenuV2 splits on `group`).
  menuItems = placeTutorialAboveChat(sortToolsByOrder(menuItems, toolOrder));

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
  const orderedCatalog = moveToolsLast(catalog);
  orderedCatalog.push(...contextualTools.filter((t) => !t.disabled));
  const catalogWithLock = placeTutorialAboveChat(
    sortToolsByOrder(orderedCatalog, toolOrder)
  ).map((t) => ({
    ...t,
    locked: LOCKED_TOOL_KEYS.has(t.key),
  }));

  return { menuItems, toolsByKey, catalog: catalogWithLock };
}
