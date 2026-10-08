import { useSelector } from "react-redux";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Whether the controls of the main base map (SectionMainBaseMapControls) show
// in the current module / displayed editor. Module-driven: the Dessin and
// BaseMaps modules keep them whichever editor (2D/3D) they display; POV and
// the Ouvrages modules only while they display the map editor; the 3D recap
// and Maillage modules never. Hidden while the create-baseMap overlay is open
// (the baseMap-related controls are meaningless there).
export default function useShowMainBaseMapControls() {
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const isCreatingBaseMap = useSelector(
    (s) => s.mapEditor.showCreateBaseMapSection
  );

  const isPovMap =
    viewerKey === "POINT_OF_VIEW" && effectiveViewerKey === "MAP";
  const isBusinessObjectsMap =
    isBusinessObjectsModuleKey(viewerKey) && effectiveViewerKey === "MAP";

  return (
    !isCreatingBaseMap &&
    (viewerKey === "MAP" ||
      viewerKey === "BASE_MAPS" ||
      isPovMap ||
      isBusinessObjectsMap)
  );
}
