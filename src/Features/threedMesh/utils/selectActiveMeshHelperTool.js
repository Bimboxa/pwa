import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Tools of the meshing mode that show their own body in the drawing helper.
const HELPER_TOOLS = ["CREATE", "NUMBER"];

// The meshing tool armed in the Maillage module that owns the drawing helper
// of the popper chain — "CREATE" (« Ajouter une maille », commandsToolbar
// ADD_MESH → SectionMeshCreateHelperContent) or "NUMBER" (« Numéroter »,
// NUMBER_MESHES → SectionMeshNumberHelperContent) — null otherwise.
export default function selectActiveMeshHelperTool(s) {
  const { active, tool } = s.threedEditor.meshingMode;
  if (!active || !HELPER_TOOLS.includes(tool)) return null;
  if (s.viewers.selectedViewerKey !== "MESHES") return null;
  if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(s))) return null;
  return tool;
}
