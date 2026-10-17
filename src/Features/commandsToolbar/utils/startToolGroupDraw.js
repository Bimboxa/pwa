import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
} from "Features/mapEditor/mapEditorSlice";

import DRAWING_TOOLS, {
  DRAWING_TOOLS_BY_TYPE,
  getDrawingToolsByType,
} from "Features/mapEditor/constants/drawingTools.jsx";
import buildToolDraft from "Features/mapEditor/utils/buildToolDraft";

// Active variant of a tool group (TOOL type of DRAWING_TOOLS_BY_TYPE): the
// requested key, else the last-used one (mapEditor.selectedToolKeyByTemplateId),
// else the first tool of the group.
export function getActiveToolOfGroup(state, templateId, toolKey) {
  const tools = getDrawingToolsByType(templateId);
  if (tools.length === 0) return null;
  const selectedKey =
    toolKey ?? state.mapEditor.selectedToolKeyByTemplateId?.[templateId];
  return (selectedKey && tools.find((t) => t.key === selectedKey)) || tools[0];
}

// Tool group (CUT, SPLIT_LINE, FACE_CUT, MOVE_ANNOTATION…) whose tool owns
// the armed drawing mode, or null. A tool arms `drawingMode ?? key`.
export function getToolTypeForDrawingMode(drawingMode) {
  if (!drawingMode) return null;
  const tool = DRAWING_TOOLS.find(
    (t) => (t.drawingMode ?? t.key) === drawingMode
  );
  if (!tool) return null;
  return (
    Object.keys(DRAWING_TOOLS_BY_TYPE).find((type) =>
      DRAWING_TOOLS_BY_TYPE[type].includes(tool.key)
    ) ?? null
  );
}

// Starts a draw of a tool group: arms the drawing mode of the active variant,
// builds its draft and records the variant as the group's last-used one (the
// in-draw Tab / letter switching and the toolbar highlight track it). Pure
// dispatch — shared by the toolbar buttons and the command hotkeys.
export default function startToolGroupDraw(
  dispatch,
  state,
  templateId,
  toolKey
) {
  const tool = getActiveToolOfGroup(state, templateId, toolKey);
  if (!tool) return;
  const newAnnotation = state.annotations.newAnnotation ?? {};
  const openingDefaults = {
    strokeWidth: state.mapEditor.openingStrokeWidth,
    strokeWidthUnit: state.mapEditor.openingStrokeWidthUnit,
  };
  dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
  dispatch(
    setNewAnnotation(buildToolDraft(newAnnotation, tool, openingDefaults))
  );
  dispatch(setSelectedToolKeyForTemplate({ templateId, toolKey: tool.key }));
}
