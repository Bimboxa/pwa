import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import {
  DRAWING_TOOLS_EDITOR_3D,
  getDrawingToolsEditor,
} from "Features/mapEditor/utils/filterDrawingToolsForEditor";

import {
  getEffectiveMeshBrushPartType,
  isMeshBrushDrawingMode,
  resolveBrushDrawingShape,
} from "./meshBrushTools";

// Redux selectors of the « Pinceau » (MESH_BRUSH). Not node-tested (aliases):
// the pure rules live in meshBrushTools / filterDrawingToolsForEditor.

// Editor whose drawing tools the tool lists offer (getDrawingToolsByShape
// `editor` option): "3D" in the Dessin module shown in its 3D editor — the
// only place 3D-only tools (the brush) are offered and armed — else "2D".
export function selectDrawingToolsEditor(s) {
  return getDrawingToolsEditor({
    moduleKey: s.viewers.selectedViewerKey,
    effectiveViewerKey: selectEffectiveViewerKey(s),
  });
}

// Part type the ARMED brush paints — the explicit part mode of the drawing
// helper (mapEditor.meshBrushPartMode "FACE" / "EDGE"), else "FACE" for a
// Surface template and "EDGE" for a Ligne template — or null when the brush
// is not active. Active when:
//   - the drawing mode is MESH_BRUSH;
//   - the draft carries an annotation template, and is neither template-less
//     nor an opening;
//   - the draft's shape (resolved from drawingShape, NOT from `type`: a
//     STRIP → brush switch keeps type "STRIP", the brush has no
//     annotationType) paints a part;
//   - the Dessin module is shown in its 3D editor.
// Leaving that context drops the flag; useTemplateFaceDrawBridge then
// disarms the tool (3D-only drawing mode).
export function selectMeshBrushPartType(s) {
  if (!isMeshBrushDrawingMode(s.mapEditor.enabledDrawingMode)) return null;
  const na = s.annotations.newAnnotation;
  if (!na?.annotationTemplateId || na.isTemplateless || na.isOpening)
    return null;
  const partType = getEffectiveMeshBrushPartType(
    resolveBrushDrawingShape(na),
    s.mapEditor.meshBrushPartMode
  );
  if (!partType) return null;
  if (selectDrawingToolsEditor(s) !== DRAWING_TOOLS_EDITOR_3D) return null;
  return partType;
}

export function selectIsMeshBrushActive(s) {
  return Boolean(selectMeshBrushPartType(s));
}

// Painting template of the armed brush (null when not active).
export function selectMeshBrushTemplateId(s) {
  return selectIsMeshBrushActive(s)
    ? s.annotations.newAnnotation.annotationTemplateId
    : null;
}
