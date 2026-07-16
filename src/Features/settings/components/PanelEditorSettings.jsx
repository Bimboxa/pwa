import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import PanelThreedProperties from "Features/threedEditor/components/PanelThreedProperties";
import SectionEditorSettings2d from "Features/mapEditor/components/SectionEditorSettings2d";

// Right-panel SETTINGS tool: edits the settings of the editor actually
// displayed — the 3D view settings (former "Vue 3D" tool panel) when a 3D
// editor is active, the 2D editor settings otherwise.
export default function PanelEditorSettings() {
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);

  const isThreed = isThreedFamilyViewerKey(effectiveViewerKey);

  if (isThreed) return <PanelThreedProperties />;

  return (
    <Box sx={{ width: 1, height: 1, overflowY: "auto" }}>
      <SectionEditorSettings2d />
    </Box>
  );
}
