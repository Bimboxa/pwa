import selectTransformToolTitle from "Features/annotationTransform/utils/selectTransformToolTitle";
import { CHANGE_STYLE_MODE } from "Features/commandsToolbar/commands/changeStyle/changeStyleMode";

// Title of the drawing helper (docked Dessin panel / floating popper) for the
// modes that are not a draw: the Extruder / Déplacer / Tourner tools and the
// « Changer de style » mode of the commands toolbar — null otherwise (the
// helper keeps its "Mode dessin" title).
export default function selectDrawingHelperTitle(s) {
  if (s.mapEditor.enabledDrawingMode === CHANGE_STYLE_MODE) {
    return "Changer de style";
  }
  return selectTransformToolTitle(s);
}
