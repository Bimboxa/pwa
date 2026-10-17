import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";

import isEditableTarget from "./isEditableTarget";
import isKeydownInsidePopup from "./isKeydownInsidePopup";

// Shared guard of every plain-letter command hotkey (the body the former
// useToolGroupHotkey / useTemplatelessDrawHotkey / useRevolutionAxisHotkey /
// useDessinToolHotkeysThreed duplicated). The letter / editor / enabled
// checks are per command (useCommandsHotkeys).
//
// - modifiers: Ctrl / Meta / Alt never fire a command (Shift is per command,
//   `hotkey.plainOnly`).
// - e.repeat: a held key must not toggle a mode back off.
// - text inputs and open popups own the keyboard.
// - an armed draw owns its own letters (in-draw variants —
//   useDrawingToolHotkeys); the 3D tool modes are NOT drawing modes, so their
//   toggles stay reachable (the command's getState decides).
// - paste / subtract pick modes own their letters.
// - docked Dessin panel on a template detail view: the pre-draw template
//   shortcuts (ToolbarStartDrawTemplate) own the plain letters there — the
//   toolbar buttons stay clickable, only the hotkeys yield.
export default function canFireCommandHotkey(e, state) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.repeat) return false;
  if (isEditableTarget(e.target)) return false;
  if (isKeydownInsidePopup(e)) return false;
  if (state.mapEditor.enabledDrawingMode) return false;
  if (state.mapEditor.pasteClipboard) return false;
  if (selectSubtractPickAnnotationId(state)) return false;
  if (state.threedEditor.walkMode.active) return false;
  if (state.leftPanel.leftPanelDocked && state.panelDrawing.detailTemplateId)
    return false;
  return true;
}
