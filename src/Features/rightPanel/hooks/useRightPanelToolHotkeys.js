import { useEffect, useRef } from "react";
import { useStore } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";
import { setCaptureToolActive } from "Features/mapEditor/mapEditorSlice";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";

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

// Global shortcuts to OPEN/CLOSE a right-panel tool by its letter (B = Banque
// d'objets — the letters shown under the tool labels in the right band) or by
// Alt+<letter> (Alt+C = Capture, Alt+E = Élévation, declared via the tool's
// `altHotkey`).
//
// Mirror of useViewerSwitchHotkeys, kept state-disjoint from the module/editor hotkeys
// so listener order never decides a race:
//   - the letter maps are rebuilt from the *filtered* menuItems, so a tool absent from
//     the current module (or from appConfig.features.tools) never binds its letter — a
//     letter with no available tool falls through without consuming the event;
//   - inert while a draw / paste / subtract is active (those own their own letters,
//     e.g. "B" = STRIP while drawing) and in walk mode;
//   - toggles: pressing the letter of the already-open tool closes it. CAPTURE
//     toggles the capture MODE, not just the panel: its frame is
//     panel-independent, so Alt+C must kill it even with the panel closed.
export default function useRightPanelToolHotkeys() {
  const store = useStore();
  const { menuItems } = useRightPanelTools();

  // Letter → tool key, rebuilt from the live (filtered) tool list so a tool that is
  // not currently in the band never binds its letter. Alt hotkeys are keyed by
  // e.code ("KeyC"): on macOS/AZERTY Alt+<letter> types another character, so
  // e.key can't identify the physical key.
  const toolKeyByLetter = {};
  const toolKeyByAltCode = {};
  menuItems.forEach((t) => {
    if (t.hotkey) toolKeyByLetter[t.hotkey.toLowerCase()] = t.key;
    if (t.altHotkey)
      toolKeyByAltCode[`Key${t.altHotkey.toUpperCase()}`] = t.key;
  });

  // Refs keep a single stable window listener while the letter maps change
  // identity on every render.
  const toolKeyByLetterRef = useRef(toolKeyByLetter);
  toolKeyByLetterRef.current = toolKeyByLetter;
  const toolKeyByAltCodeRef = useRef(toolKeyByAltCode);
  toolKeyByAltCodeRef.current = toolKeyByAltCode;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      const targetKey = e.altKey
        ? toolKeyByAltCodeRef.current[e.code]
        : toolKeyByLetterRef.current[e.key.toLowerCase()];
      if (!targetKey) return;

      const s = store.getState();
      // Walk mode owns the keyboard (arrows, Space, W to exit).
      if (s.threedEditor.walkMode.active) return;
      // A draw / paste / subtract owns its own letters (e.g. "B" = STRIP).
      if (s.mapEditor.enabledDrawingMode) return;
      if (s.mapEditor.pasteClipboard || selectSubtractPickAnnotationId(s))
        return;

      const current = s.rightPanel.selectedMenuItemKey;
      if (targetKey === "CAPTURE") {
        if (s.mapEditor.captureToolActive) {
          store.dispatch(setCaptureToolActive(false));
          if (current === "CAPTURE")
            store.dispatch(setSelectedMenuItemKey(null));
        } else {
          // Armed here too (not only by PanelCaptureTool's mount effect): the
          // panel may already be open on CAPTURE after a manual Désactiver.
          store.dispatch(setCaptureToolActive(true));
          store.dispatch(setSelectedMenuItemKey("CAPTURE"));
        }
      } else {
        // Toggle: the same tool already open → close it.
        store.dispatch(
          setSelectedMenuItemKey(current === targetKey ? null : targetKey)
        );
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [store]);
}
