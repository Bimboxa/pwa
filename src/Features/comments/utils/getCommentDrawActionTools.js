import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolsByShape } from "Features/mapEditor/constants/drawingTools.jsx";
import { pickDrawingTool } from "Features/mapEditor/utils/filterDrawingToolsForEditor";

// Tools a DRAW_ACTION block may arm for its annotation template (the 2D list
// of the template's shape — the tools of a template row) and the one it
// arms: the block's `toolKey`, else the template's default tool, else the
// first of the list.
export default function getCommentDrawActionTools(template, toolKey) {
  if (!template) return { tools: [], activeTool: null };
  const tools = getDrawingToolsByShape(resolveDrawingShape(template));
  const activeTool = pickDrawingTool(tools, [toolKey, template.defaultTool]);
  return { tools, activeTool };
}
