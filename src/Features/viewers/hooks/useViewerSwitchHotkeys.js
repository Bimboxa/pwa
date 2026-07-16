import { useEffect, useRef } from "react";
import { useStore } from "react-redux";

import useSwitchViewer from "./useSwitchViewer";
import useViewers from "./useViewers";
import { selectEffectiveViewerKey } from "../utils/effectiveViewerKey";

// Letters that keep their map-editor meaning while the Dessin module
// displays the 2D editor (see the guard in the handler below).
const MAP_EDITOR_OWNED_LETTERS = new Set(["c"]);

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

// Global module-switch shortcuts (D = Dessin, F = Fonds de plan, V = Points
// de vue, I = Maillage, C = Carnet de plans — the letters displayed under the
// module labels in the left band; "T" toggles the editor inside the current
// module instead, see useToggleThreedViewerHotkey).
//
// They are kept state-disjoint from the editor hotkeys so listener order can
// never decide a race:
//   - inert while a draw is active (!enabledDrawingMode) — the in-draw letters
//     of InteractionLayer (segment "D", rectangle X/Y, paste I/R/A/S/J, …) and
//     useDrawingToolHotkeys keep full ownership of the keyboard;
//   - inert in paste / subtract modes, which own their own letters;
//   - a letter whose viewer is already selected is ignored WITHOUT consuming
//     the event, so "D" inside the Dessin viewer still reaches the D/M/S
//     interaction-mode shortcut (useInteractionModeHotkeys). Outside the
//     Dessin viewer that hook yields "d" to us (see its DRAW guard).
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
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      const targetViewerKey = viewerKeyByLetterRef.current[e.key.toLowerCase()];
      if (!targetViewerKey) return;

      const s = store.getState();
      // Walk mode owns the keyboard (arrows, Space, W to exit).
      if (s.threedEditor.walkMode.active) return;
      if (s.mapEditor.enabledDrawingMode) return;
      if (s.mapEditor.pasteClipboard || s.mapEditor.subtractSourceAnnotationId)
        return;
      // Already there — leave the letter to the editor shortcuts (D → DRAW).
      if (targetViewerKey === s.viewers.selectedViewerKey) return;
      // While the Dessin module displays the 2D editor, that editor owns
      // these letters: "c" starts "Couper un segment" (useToolGroupHotkey).
      // Those hooks conversely yield outside Dessin+2D (other modules,
      // Dessin's 3D editor), keeping the two systems state-disjoint.
      if (
        s.viewers.selectedViewerKey === "MAP" &&
        selectEffectiveViewerKey(s) === "MAP" &&
        MAP_EDITOR_OWNED_LETTERS.has(e.key.toLowerCase())
      )
        return;

      switchViewerRef.current(targetViewerKey);
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [store]);
}
