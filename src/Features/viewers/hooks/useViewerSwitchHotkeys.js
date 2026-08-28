import { useEffect, useRef } from "react";
import { useStore } from "react-redux";

import useSwitchViewer from "./useSwitchViewer";
import useViewers from "./useViewers";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";

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

// Global module-switch shortcuts, bound as Ctrl+<letter> (Ctrl+D = Dessin,
// Ctrl+F = Fonds de plan, Ctrl+P = Points de vue, Ctrl+I = Maillage, Ctrl+B =
// Carnet de plans — displayed under the module labels in the left band; "T"
// toggles the editor inside the current module instead, see
// useToggleThreedViewerHotkey). The Ctrl requirement keeps the whole
// plain-letter namespace to the editor tools (draw letters, D/M/S, E, tool
// letters of useRightPanelToolHotkeys…).
//
// The pre-existing Ctrl-combo owners are protected so listener order can
// never decide a race:
//   - Ctrl+Z, Ctrl+C and Ctrl+V are never bound (Zones has no hotkey, Carnet
//     de plans is on Ctrl+B, Points de vue on Ctrl+P) — Undo, Copy and the
//     paste handlers keep them;
//   - inert while a MUI dialog is open, so dialog-scoped shortcuts (e.g. the
//     file selectors' document-level Ctrl+V) always win;
//   - inert while a draw / paste / subtract is active and in walk mode;
//   - a letter whose viewer is already selected is ignored WITHOUT consuming
//     the event.
export default function useViewerSwitchHotkeys() {
  const store = useStore();
  const switchViewer = useSwitchViewer();
  const viewers = useViewers();

  // Letter → module key, rebuilt from the live module list so a disabled
  // module (e.g. POV under the legacy editor) never binds its letter. Modules
  // flagged hotkeyExternal display their badge but keep their own binding.
  const viewerKeyByLetter = {};
  viewers.forEach((v) => {
    if (v.hotkey && !v.hotkeyExternal)
      viewerKeyByLetter[v.hotkey.toLowerCase()] = v.key;
  });

  // Refs keep a single stable window listener while switchViewer and the
  // letter map change identity on every render.
  const switchViewerRef = useRef(switchViewer);
  switchViewerRef.current = switchViewer;
  const viewerKeyByLetterRef = useRef(viewerKeyByLetter);
  viewerKeyByLetterRef.current = viewerKeyByLetter;

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl only — Cmd stays with the browser (Cmd+F/D/V on macOS), Shift
      // stays with redo (Ctrl+Shift+Z).
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      // A MUI dialog traps the focus, so its keydowns come from inside
      // .MuiDialog-root: yield them — the file selectors bind Ctrl+V at
      // document level to paste a clipboard image.
      if (e.target?.closest?.(".MuiDialog-root")) return;

      const letter = e.key.toLowerCase();
      const targetViewerKey = viewerKeyByLetterRef.current[letter];
      if (!targetViewerKey) return;

      const s = store.getState();
      // Walk mode owns the keyboard (arrows, Space, W to exit).
      if (s.threedEditor.walkMode.active) return;
      if (s.mapEditor.enabledDrawingMode) return;
      if (s.mapEditor.pasteClipboard || selectSubtractPickAnnotationId(s))
        return;
      // Already there — nothing to switch, don't consume.
      if (targetViewerKey === s.viewers.selectedViewerKey) return;

      switchViewerRef.current(targetViewerKey);
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [store]);
}
