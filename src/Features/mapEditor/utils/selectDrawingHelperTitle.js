import selectTransformToolTitle from "Features/annotationTransform/utils/selectTransformToolTitle";
import { CHANGE_STYLE_MODE } from "Features/commandsToolbar/commands/changeStyle/changeStyleMode";
import { HIDE_ANNOTATION_MODE } from "Features/commandsToolbar/commands/hideAnnotation/hideAnnotationMode";
import selectActiveMeshHelperTool from "Features/threedMesh/utils/selectActiveMeshHelperTool";
import {
  selectIsCutLineDrawActive,
  selectIsCutPlaneDrawActive,
} from "Features/threedDrawing/utils/templateFaceDrawSelectors";
import {
  isBaseMapLinkDraft,
  isBaseMapLinkLocateDraft,
} from "Features/baseMapLinks/utils/startBaseMapLinkTools";

// Title of the drawing helper (docked Dessin panel / floating popper) for the
// modes that are not a plain draw: the Extruder / Déplacer / Tourner tools,
// the « Changer de style » / « Masquer l'annotation » modes of the commands
// toolbar, « Ajouter une maille » / « Numéroter » / « Dessiner une ligne de coupe »
// (Maillage module) and the section marks of the Fonds de plan
// module (drawn on a plan / located on a vertical base map) — null otherwise
// (the helper keeps its "Mode dessin" title).
export default function selectDrawingHelperTitle(s) {
  if (s.mapEditor.enabledDrawingMode === CHANGE_STYLE_MODE) {
    return "Changer de style";
  }
  if (s.mapEditor.enabledDrawingMode === HIDE_ANNOTATION_MODE) {
    return "Masquer l'annotation";
  }
  const meshHelperTool = selectActiveMeshHelperTool(s);
  if (meshHelperTool === "CREATE") return "Ajouter une maille";
  if (meshHelperTool === "NUMBER") return "Numéroter";
  if (selectIsCutPlaneDrawActive(s)) return "Dessiner un plan de coupe";
  if (selectIsCutLineDrawActive(s)) return "Dessiner une ligne de coupe";
  if (s.mapEditor.enabledDrawingMode) {
    const draft = s.annotations.newAnnotation;
    if (isBaseMapLinkLocateDraft(draft)) return "Repérage du trait de coupe";
    if (isBaseMapLinkDraft(draft)) return "Trait de coupe";
  }
  return selectTransformToolTitle(s);
}
