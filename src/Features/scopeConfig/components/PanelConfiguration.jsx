import { useState } from "react";

import { useSelector } from "react-redux";

import useViewers from "Features/viewers/hooks/useViewers";
import useRightPanelTools from "Features/rightPanel/hooks/useRightPanelTools";

import { Box, Divider } from "@mui/material";

import NavConfigurationList from "./NavConfigurationList";
import PageDonneesPreferences from "./PageDonneesPreferences";
import PageModulesToolsMockup from "./PageModulesToolsMockup";
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

  // state

  const [selection, setSelection] = useState(DEFAULT_SELECTION);

  // helpers

  // The per-scope sections only exist with a selected scope; a stale
  // selection (scope closed, module gone) falls back to Données & préférences.
  const selectedModule =
    selection.type === "MODULE"
      ? modules.find((m) => m.key === selection.key)
      : null;
  const selectedTool =
    selection.type === "TOOL"
      ? catalog.find((t) => t.key === selection.key)
      : null;
  let effectiveSelection = selection;
  if (
    (selection.type === "MODULE" && (!scopeId || !selectedModule)) ||
    (selection.type === "TOOL" && (!scopeId || !selectedTool)) ||
    (selection.type === "GENERAL" &&
      selection.key === "MODULES_TOOLS" &&
      !scopeId)
  ) {
    effectiveSelection = FALLBACK_SELECTION;
  }

  // render

  return (
    <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
      <NavConfigurationList
        modules={modules}
        tools={catalog}
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
            <PageModulesToolsMockup modules={modules} tools={catalog} />
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
