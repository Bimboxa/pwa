import { useSelector } from "react-redux";

import {
  selectDisabledModuleKeys,
  selectModuleOrder,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

import useBusinessObjectsModules from "Features/businessObjects/hooks/useBusinessObjectsModules";
import useScopeModuleLabel from "Features/listingViewer/hooks/useScopeModuleLabel";
import sortModulesByOrder from "../utils/sortModulesByOrder";

import {
  Map,
  MenuBook,
  PictureAsPdf as PdfIcon,
  TableChart as Table,
  Print,
  AdminPanelSettings,
  Draw,
  Layers,
  Topic,
  ViewInAr,
  GridOn,
  PhotoCamera,
  PhotoLibrary,
  AccountTree,
} from "@mui/icons-material";

import theme from "Styles/theme";

// Modules that can never be disabled from the Configuration dialog: the app
// always keeps the scope overview and its two core modules. Also shields
// against imported scopeConfig rows that would list them as disabled.
export const LOCKED_MODULE_KEYS = new Set(["SCOPE", "BASE_MAPS", "MAP"]);

// Each entry is a MODULE of the left band. `editors` lists the editors the
// module can display (default: the module's own key). Multi-editor modules
// (BASE_MAPS, MAP, POINT_OF_VIEW, ZONES, THREED) expose the 2D/3D toggle
// ("T" + topBar button), which changes the displayed editor without moving
// the left-band selection.
//
// `hotkey` is the module-switch letter, bound as Ctrl+<letter> in
// useViewerSwitchHotkeys and displayed as "Ctrl+X" under the module label.
//
// `ignoreScopeConfig`: the Configuration dialog lists every module including
// the per-scope disabled ones (db.scopeConfigs); every other consumer gets
// the scope-filtered list, so the band, the module selector and the
// Ctrl+letter hotkeys all drop a disabled module for free.
//
// The business-objects modules (one per type of the
// businessObjectTypesCatalog registry, label / icon configurable per scope)
// are built by useBusinessObjectsModules. The per-scope module order
// (scopeConfigs.moduleOrder) is applied last, on both paths, so the band and
// the Configuration dialog show the same order.
export default function useViewers({ ignoreScopeConfig = false } = {}) {
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);
  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const moduleOrder = useSelector(selectModuleOrder);
  const businessObjectsModules = useBusinessObjectsModules();
  const scopeModuleLabel = useScopeModuleLabel();

  const viewers = [
    {
      key: "SCOPE",
      label: scopeModuleLabel,
      shortLabel: scopeModuleLabel,
      icon: <Topic />,
      bgcolor: theme.palette.viewers.scope,
      // Overview of the scope: the listings on the left, the base maps and
      // their quantities in the editor. Locked (LOCKED_MODULE_KEYS) and
      // pinned first (PINNED_TOP_MODULE_KEYS) — the entry point of a scope.
      // No hotkey: Ctrl+S is the browser save dialog, not reliably cancelable.
      // 2D-only: the module hosts its own viewer, no map editor.
    },
    {
      key: "BASE_MAPS",
      label: "Fonds de plan",
      shortLabel: "Fonds de plan",
      icon: <Layers />,
      bgcolor: theme.palette.viewers.map,
      hotkey: "F",
      // The 2D editor is the module's own MainMapEditorV3 instance (not the
      // shared "MAP" one); the 3D editor is the shared MainThreedEditor.
      editors: ["BASE_MAPS", "THREED"],
    },
    {
      key: "MAP",
      label: "Dessin",
      shortLabel: "Dessin",
      icon: <Draw />,
      bgcolor: theme.palette.viewers.map,
      hotkey: "D",
      editors: ["MAP", "THREED"],
    },
    {
      key: "PHOTOS",
      label: "Photos",
      shortLabel: "Photos",
      icon: <PhotoCamera />,
      bgcolor: theme.palette.viewers.photos,
      // Relies on the V3 map editor (the legacy branch renders V2).
      disabled: legacy,
      // 2D-only module: displays the shared MainMapEditorV3 instance (like
      // Zones), no 3D editor and therefore no "T" toggle.
      editors: ["MAP"],
    },
    {
      key: "POINT_OF_VIEW",
      label: "Points de vue",
      shortLabel: "Points de vue",
      icon: <PhotoLibrary />,
      bgcolor: theme.palette.viewers.pov,
      // The POV viewer relies on the V3 map editor capture host.
      disabled: legacy,
      // Not "V": plain V is the Capture tool (useRightPanelToolHotkeys) and
      // Ctrl+V stays with the paste handlers. Ctrl+P is free — the browser
      // print dialog is blocked by preventDefault on match.
      hotkey: "P",
      editors: ["MAP", "THREED"],
    },
    {
      key: "PORTFOLIO",
      label: "Carnet de plans",
      shortLabel: "Carnet de plans",
      icon: <MenuBook />,
      bgcolor: theme.palette.viewers.portfolio,
      // Not "C": Ctrl+C stays Copy (annotations). "B" as in book/carnet.
      hotkey: "B",
    },
    {
      key: "THREED",
      label: "Viewer",
      shortLabel: "Viewer",
      bgcolor: theme.palette.viewers.threed,
      icon: <ViewInAr />,
      // No hotkey: "T" toggles the editor inside multi-editor modules
      // (useToggleThreedViewerHotkey), it no longer selects this module.
      // Read-only overview of the created annotations: lands on the 3D
      // editor, "T" / topBar button toggles to the 2D editor on the main map.
      editors: ["THREED", "MAP"],
    },
    {
      key: "MESHES",
      label: "Maillage",
      shortLabel: "Maillage",
      icon: <GridOn />,
      bgcolor: theme.palette.viewers.meshes,
      hotkey: "I",
    },
    {
      key: "ZONES",
      label: "Zones",
      shortLabel: "Zones",
      icon: <AccountTree />,
      bgcolor: theme.palette.viewers.zones,
      // No hotkey: Ctrl+Z stays Undo everywhere.
      // 2D editor = "MAP": the module displays the shared MainMapEditorV3
      // instance (like Dessin / POV / Viewer) so entering the module keeps the
      // camera framing. The zonings tree is mounted beside it in SectionViewer.
      editors: ["MAP", "THREED"],
      // Relies on the V3 map editor (the legacy branch renders V2).
      disabled: legacy,
    },
    // Business-objects modules ("Ouvrages" for the STANDARD type, Ctrl+O —
    // free: the browser open-file dialog is blocked by preventDefault on
    // match, same argument as Ctrl+P above).
    ...businessObjectsModules,
    {
      key: "PRINT",
      label: "Format impression",
      shortLabel: "Impression",
      icon: <Print />,
      disabled: true,
    },
    {
      key: "TABLE",
      label: "Quantités",
      shortLabel: "Quantités",
      icon: <Table />,
      bgcolor: theme.palette.viewers.map,
      disabled: true,
    },
    {
      key: "ADMIN",
      label: "Gestionnaire de donnees",
      shortLabel: "Admin",
      icon: <AdminPanelSettings />,
      bgcolor: theme.palette.viewers.admin,
      disabled: true,
    },
    {
      key: "LEAFLET",
      label: "Carte satellite",
      shortLabel: "Satellite",
      icon: <Map />,
      bgcolor: theme.palette.viewers.map,
      disabled: true,
    },
    {
      key: "PDF",
      label: "PDF",
      shortLabel: "PDF",
      bgcolor: theme.palette.viewers.threed,
      icon: <PdfIcon />,
      disabled: true,
    },
  ];

  const modules = viewers
    .filter((v) => !v.disabled)
    .filter(
      (v) =>
        ignoreScopeConfig ||
        LOCKED_MODULE_KEYS.has(v.key) ||
        !disabledModuleKeys.includes(v.key)
    )
    .map((v) => ({ ...v, editors: v.editors ?? [v.key] }));

  return sortModulesByOrder(modules, moduleOrder);
}
