import { useEffect, useRef } from "react";
import { useStore } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import useRightPanelTools from "./useRightPanelTools";

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// Global shortcuts to OPEN/CLOSE a right-panel tool by its letter (N = Élévation,
// B = Banque d'objets — the letters shown under the tool labels in the right band).
//
// Mirror of useViewerSwitchHotkeys, kept state-disjoint from the module/editor hotkeys
// so listener order never decides a race:
//   - the letter map is rebuilt from the *filtered* menuItems, so a tool absent from
//     the current module (or from appConfig.features.tools) never binds its letter — a
//     letter with no available tool falls through without consuming the event;
//   - inert while a draw / paste / subtract is active (those own their own letters,
//     e.g. "B" = STRIP while drawing) and in walk mode;
//   - toggles: pressing the letter of the already-open tool closes it.
export default function useRightPanelToolHotkeys() {
  const store = useStore();
  const { menuItems } = useRightPanelTools();

  // Letter → tool key, rebuilt from the live (filtered) tool list so a tool that is
  // not currently in the band never binds its letter.
  const toolKeyByLetter = {};
  menuItems.forEach((t) => {
    if (t.hotkey) toolKeyByLetter[t.hotkey.toLowerCase()] = t.key;
  });

  // A ref keeps a single stable window listener while the letter map changes
  // identity on every render.
  const toolKeyByLetterRef = useRef(toolKeyByLetter);
  toolKeyByLetterRef.current = toolKeyByLetter;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      const targetKey = toolKeyByLetterRef.current[e.key.toLowerCase()];
      if (!targetKey) return;

      const s = store.getState();
      // Walk mode owns the keyboard (arrows, Space, W to exit).
      if (s.threedEditor.walkMode.active) return;
      // A draw / paste / subtract owns its own letters (e.g. "B" = STRIP).
      if (s.mapEditor.enabledDrawingMode) return;
      if (s.mapEditor.pasteClipboard || s.mapEditor.subtractSourceAnnotationId)
        return;

      // Toggle: the same tool already open → close it.
      const current = s.rightPanel.selectedMenuItemKey;
      store.dispatch(
        setSelectedMenuItemKey(current === targetKey ? null : targetKey)
      );
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [store]);
}
