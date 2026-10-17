import { getDrawingToolsByType } from "Features/mapEditor/constants/drawingTools.jsx";

import startToolGroupDraw, { getActiveToolOfGroup } from "./startToolGroupDraw";
import { getToolGroupState } from "./drawToolCommandState";

// Command of a 2D / 3D drawing tool group (a type of DRAWING_TOOLS_BY_TYPE:
// CUT, SPLIT_LINE, FACE_CUT…): the button arms the group's active variant,
// the variants (when the group has several tools) feed the split button of
// the toolbar. `extra` overrides / completes the command (hotkey yields…).
export default function createToolGroupCommand({
  key,
  toolType = key,
  label,
  Icon,
  editors,
  hotkey,
  ...extra
}) {
  const tools = getDrawingToolsByType(toolType);
  const command = {
    key,
    label,
    Icon,
    editors,
    hotkey,
    getState: (ctx) => getToolGroupState(ctx, toolType),
    run: (ctx, { dispatch, store }, variantKey) =>
      startToolGroupDraw(dispatch, store.getState(), toolType, variantKey),
    ...extra,
  };
  if (tools.length > 1) {
    command.variants = () =>
      tools.map((tool) => ({
        key: tool.key,
        label: tool.label,
        Icon: tool.Icon,
      }));
    command.getActiveVariant = (ctx) => {
      const active = getActiveToolOfGroup(
        {
          mapEditor: {
            selectedToolKeyByTemplateId: ctx.selectedToolKeyByTemplateId,
          },
        },
        toolType
      );
      return active
        ? { key: active.key, label: active.label, Icon: active.Icon }
        : null;
    };
  }
  return command;
}
