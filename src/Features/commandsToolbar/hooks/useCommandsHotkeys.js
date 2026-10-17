import { useEffect } from "react";
import { useStore } from "react-redux";

import { COMMANDS } from "../commands";
import canFireCommandHotkey from "../utils/canFireCommandHotkey";
import getCommandState from "../utils/getCommandState";
import { setClaimedLetters } from "../utils/hotkeyClaims";

// Letters a command's hotkey covers in the given editor.
export function commandHotkeyAppliesTo(command, editor) {
  const hotkey = command.hotkey;
  if (!hotkey?.key) return false;
  return !hotkey.editors || hotkey.editors.includes(editor);
}

// ---------------------------------------------------------------------------
// useCommandsHotkeys — the ONE window keydown listener (capture phase) of the
// plain-letter command hotkeys, driven by the `hotkey` metadata of the
// registry (replaces the per-tool hooks: useToolGroupHotkey ×9,
// useOpeningHotkey, useTemplatelessDrawHotkey, useRevolutionAxisHotkey,
// useDessinToolHotkeysThreed and the « E » Évider case of InteractionLayer).
//
// For the pressed letter, in registry order: a command whose hotkey matches
// the letter and the displayed editor, whose shared guard passes
// (canFireCommandHotkey), whose getState is enabled and whose `yieldWhen`
// does not yield, runs — the event is consumed. No match: the event goes on
// to its other owners (right panel tools, module switching…).
//
// Every render publishes the letters currently claimed by an enabled command
// (utils/hotkeyClaims) so useRightPanelToolHotkeys yields on them without
// hardcoding « E » for Évider / Extruder.
// ---------------------------------------------------------------------------
export default function useCommandsHotkeys({ ctxRef, deps, enabled }) {
  const store = useStore();
  const ctx = ctxRef.current;

  // claims — recomputed each render from the current context
  const claimed = new Set();
  if (enabled && ctx) {
    COMMANDS.forEach((command) => {
      if (!commandHotkeyAppliesTo(command, ctx.editor)) return;
      if (!getCommandState(command, ctx).enabled) return;
      claimed.add(command.hotkey.key.toLowerCase());
    });
  }
  setClaimedLetters(claimed);

  useEffect(() => {
    if (!enabled) {
      setClaimedLetters([]);
      return undefined;
    }

    const handleKeyDown = (e) => {
      const letter = e.key?.toLowerCase?.();
      if (!letter || letter.length !== 1) return;
      const currentCtx = ctxRef.current;
      if (!currentCtx) return;
      const state = store.getState();

      for (const command of COMMANDS) {
        const hotkey = command.hotkey;
        if (!hotkey?.key || hotkey.key.toLowerCase() !== letter) continue;
        if (!commandHotkeyAppliesTo(command, currentCtx.editor)) continue;
        if (hotkey.plainOnly && e.shiftKey) continue;
        if (!canFireCommandHotkey(e, state)) return;
        const commandState = getCommandState(command, currentCtx);
        if (!commandState.enabled) continue;
        if (hotkey.yieldWhen?.(state, currentCtx)) continue;
        command.run(currentCtx, deps);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      setClaimedLetters([]);
    };
  }, [enabled, ctxRef, deps, store]);
}
