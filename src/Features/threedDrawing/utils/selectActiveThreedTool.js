import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// The threedEditor tool armed from the « Outils de dessin » rows of the
// Dessin module's 3D editor (commandsToolbar commands): "EXTRUDE" |
// "MOVE_ANNOTATION" | "VERTEX_OFFSET" (Déplacer armed on a selected face) |
// "ROTATE_ANNOTATION" | "ISOLATE_FACE" (Isoler une face) | "MERGE_FACES"
// (Fusionner des faces), or null. Drives the drawing helper
// swap (PopperMapListings / PanelDrawing) and its content. Null outside
// "Dessin module + 3D editor shown": the other modules keep their bottom
// toolbars (ExtrudeToolbarThreed in Maillage) — except « Déplacer » /
// « Tourner » in the Maillage module, which carry a cut line there
// (Features/threedCutLines) with the same helper.
export default function selectActiveThreedTool(s) {
  const moduleKey = s.viewers.selectedViewerKey;
  if (moduleKey !== "MAP" && moduleKey !== "MESHES") return null;
  if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(s))) return null;
  if (moduleKey === "MESHES") {
    if (s.threedEditor.moveAnnotationMode.active) return "MOVE_ANNOTATION";
    if (s.threedEditor.rotateAnnotationMode.active) return "ROTATE_ANNOTATION";
    return null;
  }
  if (s.threedEditor.extrudeMode.active) return "EXTRUDE";
  if (s.threedEditor.moveAnnotationMode.active) return "MOVE_ANNOTATION";
  if (s.threedEditor.vertexOffsetMode.active) return "VERTEX_OFFSET";
  if (s.threedEditor.rotateAnnotationMode.active) return "ROTATE_ANNOTATION";
  if (s.threedEditor.isolateFaceMode.active) return "ISOLATE_FACE";
  if (s.threedEditor.mergeFacesMode.active) return "MERGE_FACES";
  return null;
}
