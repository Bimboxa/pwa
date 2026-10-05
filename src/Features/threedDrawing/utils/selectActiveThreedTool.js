import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// The threedEditor tool armed from the « Outils de dessin » rows of the
// Dessin module's 3D editor (TOOL_ITEMS `threedTool`): "EXTRUDE" |
// "MOVE_ANNOTATION" | "ROTATE_ANNOTATION", or null. Drives the drawing helper
// swap (PopperMapListings / PanelDrawing) and its content. Null outside
// "Dessin module + 3D editor shown": the other modules keep their bottom
// toolbars (ExtrudeToolbarThreed in Maillage).
export default function selectActiveThreedTool(s) {
  if (s.viewers.selectedViewerKey !== "MAP") return null;
  if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(s))) return null;
  if (s.threedEditor.extrudeMode.active) return "EXTRUDE";
  if (s.threedEditor.moveAnnotationMode.active) return "MOVE_ANNOTATION";
  if (s.threedEditor.rotateAnnotationMode.active) return "ROTATE_ANNOTATION";
  return null;
}
