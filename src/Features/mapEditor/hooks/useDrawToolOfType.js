import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
} from "Features/mapEditor/mapEditorSlice";

import { getDrawingToolsByType } from "Features/mapEditor/constants/drawingTools.jsx";
import buildToolDraft from "Features/mapEditor/utils/buildToolDraft";

// ---------------------------------------------------------------------------
// useDrawToolOfType — tool resolution + activation dispatches for one cut /
// split tool type (TOOL_ITEMS entries). Shared by PopperMapListings' ToolRow
// and the Dessin left panel tool rows.
// ---------------------------------------------------------------------------

export default function useDrawToolOfType(type) {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedToolKey = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId[type]
  );
  const openingStrokeWidth = useSelector((s) => s.mapEditor.openingStrokeWidth);
  const openingStrokeWidthUnit = useSelector(
    (s) => s.mapEditor.openingStrokeWidthUnit
  );

  // helpers

  const openingDefaults = {
    strokeWidth: openingStrokeWidth,
    strokeWidthUnit: openingStrokeWidthUnit,
  };

  const tools = getDrawingToolsByType(type);
  const activeTool = selectedToolKey
    ? (tools.find((t) => t.key === selectedToolKey) ?? tools[0])
    : tools[0];

  // handlers

  const startDraw = () => {
    if (!activeTool) return;
    dispatch(setEnabledDrawingMode(activeTool.drawingMode ?? activeTool.key));
    dispatch(
      setNewAnnotation(buildToolDraft(newAnnotation, activeTool, openingDefaults))
    );
  };

  const selectToolAndDraw = (tool) => {
    dispatch(
      setSelectedToolKeyForTemplate({ templateId: type, toolKey: tool.key })
    );
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
    dispatch(
      setNewAnnotation(buildToolDraft(newAnnotation, tool, openingDefaults))
    );
  };

  return { tools, activeTool, startDraw, selectToolAndDraw };
}
