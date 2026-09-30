import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { selectIsObject3DPlacementActive } from "Features/threedEditor/utils/object3DPlacementSelectors";

// The 3D base maps grid can be opened when a 3D editor is displayed and no
// other tool owns the scene. Not available in the Maillage module (MESHES
// viewer: meshing mode is forced on there).
export default function selectCanOpenBaseMapsGrid3d(s) {
  if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(s))) return false;
  if (s.viewers.selectedViewerKey === "MESHES") return false;
  if (selectCaptureFramingActive(s)) return false;
  if (s.mapEditor.enabledDrawingMode) return false;
  if (selectIsObject3DPlacementActive(s)) return false;

  const t = s.threedEditor;
  if (t.editorMode === "BASEMAP_POSITION") return false;
  return !(
    t.drawingMode.active ||
    t.dimensionMode.active ||
    t.meshingMode.active ||
    t.extrudeMode.active ||
    t.walkMode.active ||
    t.moveBaseMapMode.active ||
    t.rotateBaseMapMode.active ||
    t.moveAnnotationMode.active ||
    t.rotateAnnotationMode.active
  );
}
