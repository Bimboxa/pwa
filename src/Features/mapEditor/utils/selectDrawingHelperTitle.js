import selectTransformToolTitle from "Features/annotationTransform/utils/selectTransformToolTitle";
import { CHANGE_STYLE_MODE } from "Features/commandsToolbar/commands/changeStyle/changeStyleMode";
import selectIsMeshCreateToolActive from "Features/threedMesh/utils/selectIsMeshCreateToolActive";
import {
  isBaseMapLinkDraft,
  isBaseMapLinkLocateDraft,
} from "Features/baseMapLinks/utils/startBaseMapLinkTools";

// Title of the drawing helper (docked Dessin panel / floating popper) for the
// modes that are not a plain draw: the Extruder / Déplacer / Tourner tools,
// the « Changer de style » mode of the commands toolbar, « Ajouter une
// maille » (Maillage module) and the section marks of the Fonds de plan
// module (drawn on a plan / located on a vertical base map) — null otherwise
// (the helper keeps its "Mode dessin" title).
export default function selectDrawingHelperTitle(s) {
  if (s.mapEditor.enabledDrawingMode === CHANGE_STYLE_MODE) {
    return "Changer de style";
  }
  if (selectIsMeshCreateToolActive(s)) return "Ajouter une maille";
  if (s.mapEditor.enabledDrawingMode) {
    const draft = s.annotations.newAnnotation;
    if (isBaseMapLinkLocateDraft(draft)) return "Repérage du trait de coupe";
    if (isBaseMapLinkDraft(draft)) return "Trait de coupe";
  }
  return selectTransformToolTitle(s);
}
