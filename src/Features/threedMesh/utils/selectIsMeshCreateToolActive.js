import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// The CREATE tool of the meshing mode is armed in the Maillage module
// (« Ajouter une maille » — commandsToolbar ADD_MESH, or the « + » of the
// bottom meshing toolbar): the drawing helper shows its own body
// (SectionMeshCreateHelperContent) in the popper chain, like the cut line
// drawn in this module.
export default function selectIsMeshCreateToolActive(s) {
  return (
    s.threedEditor.meshingMode.active &&
    s.threedEditor.meshingMode.tool === "CREATE" &&
    s.viewers.selectedViewerKey === "MESHES" &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}
