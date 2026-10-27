import { useState } from "react";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import useChangeAnnotationsTemplate from "Features/annotations/hooks/useChangeAnnotationsTemplate";

import CommandButton from "../../components/CommandButton";
import { useCommandMenu } from "../../components/CommandMenuContext";
import MenuPickChangeStyleTemplate from "./MenuPickChangeStyleTemplate";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";
import { CHANGE_STYLE_MODE } from "./changeStyleMode";

// Button of « Changer de style » (commandsToolbar). Two behaviours:
// - inside a menu (right-click shortcuts, group menu): the item acts on the
//   selection now — gated by the selection gate — and opens the template
//   picker on the menu anchor (the hosting menu is keepMounted, the picker
//   survives its closing);
// - in the toolbar row: toggles the CHANGE_STYLE drawing mode, whose helper
//   panel (SectionChangeStyleHelper) owns the picker.
export default function ButtonChangeStyle({
  command,
  ctx,
  deps,
  state,
  hotkeyLabel,
}) {
  const menu = useCommandMenu();
  const isMenu = menu?.variant === "menu";

  // data

  const changeAnnotationsTemplate = useChangeAnnotationsTemplate();
  const targets = getTargets(ctx);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const effectiveState = isMenu ? (getSelectionGate(ctx) ?? state) : state;

  // handlers

  function handleClick(event, anchor) {
    if (isMenu) {
      setAnchorEl(anchor);
      return;
    }
    const armed = ctx.enabledDrawingMode === CHANGE_STYLE_MODE;
    deps.dispatch(setEnabledDrawingMode(armed ? null : CHANGE_STYLE_MODE));
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleTemplateChange(_templateId, template) {
    try {
      await changeAnnotationsTemplate(targets, template, {
        baseMap: ctx.baseMap,
      });
    } catch (e) {
      console.error("[changeStyle]", e);
    } finally {
      handleClose();
    }
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...effectiveState, active: effectiveState.active || open }}
        onClick={handleClick}
      />
      {isMenu && (
        <MenuPickChangeStyleTemplate
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          annotations={targets}
          onChange={handleTemplateChange}
        />
      )}
    </>
  );
}
