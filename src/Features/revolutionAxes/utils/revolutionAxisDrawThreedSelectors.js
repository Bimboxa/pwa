import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Drawing a revolution axis from the 3D editor is fully derived state: the
// "Axe de révolution" tool row arms the regular 2D drawing state
// (REVOLUTION_AXIS draft + REVOLUTION_AXIS_PLAN mode); when the Dessin
// module shows its 3D editor, that same state requests the 3D two-click
// axis mode instead. Mirrors selectIsTemplateCoteDrawActive.
export function selectIsRevolutionAxisDrawThreedActive(s) {
  const na = s.annotations.newAnnotation;
  return (
    s.mapEditor.enabledDrawingMode === "REVOLUTION_AXIS_PLAN" &&
    na?.type === "REVOLUTION_AXIS" &&
    s.viewers.selectedViewerKey === "MAP" &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}
