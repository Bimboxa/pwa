import { useState } from "react";

import { useSelector } from "react-redux";

import useViewers, {
  LOCKED_MODULE_KEYS,
} from "Features/viewers/hooks/useViewers";
import useRightPanelTools from "Features/rightPanel/hooks/useRightPanelTools";

import {
  selectDisabledModuleKeys,
  selectDisabledToolKeys,
} from "../utils/scopeConfigSelectors";

import { Box, Divider } from "@mui/material";

import NavConfigurationList from "./NavConfigurationList";
import PageDonneesPreferences from "./PageDonneesPreferences";
import PageModulesTools from "./PageModulesTools";
import PageModuleConfig from "./PageModuleConfig";
import PageToolConfig from "./PageToolConfig";
import PageEditor2d from "./PageEditor2d";
import PageEditor3d from "./PageEditor3d";
import PageSatelliteMap from "./PageSatelliteMap";

const DEFAULT_SELECTION = { type: "GENERAL", key: "MODULES_TOOLS" };
const FALLBACK_SELECTION = { type: "GENERAL", key: "DATA_PREFS" };

// Two-column body of the Configuration dialog: left summary column
// (Généralités / Modules / Outils / Éditeurs), right content page.
export default function PanelConfiguration({ onClose }) {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const modules = useViewers({ ignoreScopeConfig: true });
  const { catalog } = useRightPanelTools();
  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const disable3D = useSelector((s) => s.appConfig.disable3D);

  // state

  const [selection, setSelection] = useState(DEFAULT_SELECTION);

  // helpers

  // The nav column lists the ENABLED modules and tools only — like the left
  // band and the right band do — so disabling one from a switch removes its
  // entry instead of dimming it. The pages themselves keep receiving the
  // FULL catalogs: "Modules & outils" is where a disabled item is switched
  // back on, and the per-module matrices show the whole picture.
  const navModules = modules.filter(
    (m) => LOCKED_MODULE_KEYS.has(m.key) || !disabledModuleKeys.includes(m.key)
  );
  const navTools = catalog.filter(
    (t) => t.locked || !disabledToolKeys.includes(t.key)
  );
  // Same rule for the "Éditeur 3D" page: with the 3D off (SectionThreedConfig
  // / Données & préférences) the modules fall back to their 2D editor, so
  // there is no 3D editor left to configure.
  const show3dEditor = !disable3D;

  // A selection that left the nav column (module / tool just disabled, or
  // gone from the catalog) falls back to the page it is toggled from; the
  // per-scope sections only exist with a selected scope, so without one
  // everything scope-bound falls back to Données & préférences.
  const selectedModule =
    selection.type === "MODULE"
      ? navModules.find((m) => m.key === selection.key)
      : null;
  const selectedTool =
    selection.type === "TOOL"
      ? navTools.find((t) => t.key === selection.key)
      : null;
  let effectiveSelection = selection;
  if (
    (selection.type === "MODULE" && !selectedModule) ||
    (selection.type === "TOOL" && !selectedTool) ||
    (selection.type === "EDITOR" &&
      selection.key === "EDITOR_3D" &&
      !show3dEditor)
  ) {
    effectiveSelection = DEFAULT_SELECTION;
  }
  if (
    !scopeId &&
    (effectiveSelection.type === "MODULE" ||
      effectiveSelection.type === "TOOL" ||
      (effectiveSelection.type === "GENERAL" &&
        effectiveSelection.key === "MODULES_TOOLS"))
  ) {
    effectiveSelection = FALLBACK_SELECTION;
  }

  // render

  return (
    <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
      <NavConfigurationList
        modules={navModules}
        tools={navTools}
        show3dEditor={show3dEditor}
        showScopeSections={Boolean(scopeId)}
        selection={effectiveSelection}
        onSelect={setSelection}
      />
      <Divider orientation="vertical" flexItem />
      <Box sx={{ flexGrow: 1, minWidth: 0, overflowY: "auto" }}>
        {effectiveSelection.type === "GENERAL" &&
          effectiveSelection.key === "DATA_PREFS" && (
            <PageDonneesPreferences onClose={onClose} />
          )}
        {effectiveSelection.type === "GENERAL" &&
          effectiveSelection.key === "MODULES_TOOLS" && (
            <PageModulesTools
              modules={modules}
              tools={catalog}
              onSelect={setSelection}
            />
          )}
        {effectiveSelection.type === "MODULE" && selectedModule && (
          <PageModuleConfig module={selectedModule} tools={catalog} />
        )}
        {effectiveSelection.type === "TOOL" && selectedTool && (
          <PageToolConfig tool={selectedTool} modules={modules} />
        )}
        {effectiveSelection.type === "EDITOR" &&
          effectiveSelection.key === "EDITOR_2D" && <PageEditor2d />}
        {effectiveSelection.type === "EDITOR" &&
          effectiveSelection.key === "EDITOR_3D" && <PageEditor3d />}
        {effectiveSelection.type === "EDITOR" &&
          effectiveSelection.key === "SATELLITE" && <PageSatelliteMap />}
      </Box>
    </Box>
  );
}
