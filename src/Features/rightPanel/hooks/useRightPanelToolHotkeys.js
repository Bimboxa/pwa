import { useEffect, useRef } from "react";
import { useStore } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";
import { setCaptureToolActive } from "Features/mapEditor/mapEditorSlice";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

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

// Global shortcuts to OPEN/CLOSE a right-panel tool by its plain letter (I =
// Propriétés, E = Élévation, B = Banque d'objets, V = Capture — the letters
// shown under the tool labels in the right band; modules switch on
// Ctrl+<letter>, see useViewerSwitchHotkeys).
//
// Mirror of useViewerSwitchHotkeys, kept state-disjoint from the module/editor hotkeys
// so listener order never decides a race:
//   - the letter map is rebuilt from the *filtered* menuItems, so a tool absent from
//     the current module (or from appConfig.features.tools) never binds its letter — a
//     letter with no available tool falls through without consuming the event;
//   - inert while a draw / paste / subtract is active (those own their own letters,
//     e.g. "B" = STRIP and "v" = smart-detect vectorize while drawing) and in
//     walk mode;
//   - "E" yields (without consuming) while a POLYGON is selected on the 2D
//     map: the InteractionLayer "Évider" handler keeps it;
//   - toggles: pressing the letter of the already-open tool closes it. CAPTURE
//     toggles the capture MODE explicitly (frame + panel move together, but the
//     mode flag is dispatched here too so the toggle never depends on the
//     panel's mount/unmount effects alone).
export default function useRightPanelToolHotkeys() {
  const store = useStore();
  const { menuItems } = useRightPanelTools();

  // Letter → tool key, rebuilt from the live (filtered) tool list so a tool that is
  // not currently in the band never binds its letter.
  const toolKeyByLetter = {};
  menuItems.forEach((t) => {
    if (t.hotkey) toolKeyByLetter[t.hotkey.toLowerCase()] = t.key;
  });

  // Ref keeps a single stable window listener while the letter map changes
  // identity on every render.
  const toolKeyByLetterRef = useRef(toolKeyByLetter);
  toolKeyByLetterRef.current = toolKeyByLetter;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      const letter = e.key.toLowerCase();
      const targetKey = toolKeyByLetterRef.current[letter];
      if (!targetKey) return;

      const s = store.getState();
      // Walk mode owns the keyboard (arrows, Space, W to exit).
      if (s.threedEditor.walkMode.active) return;
      // A draw / paste / subtract owns its own letters (e.g. "B" = STRIP).
      if (s.mapEditor.enabledDrawingMode) return;
      if (s.mapEditor.pasteClipboard || selectSubtractPickAnnotationId(s))
        return;
      // "E" keeps its "Évider" meaning while a POLYGON is selected on the 2D
      // map — yield without consuming so InteractionLayer's handler fires
      // (mirror of its own guards).
      if (
        letter === "e" &&
        s.viewers.selectedViewerKey === "MAP" &&
        selectEffectiveViewerKey(s) === "MAP" &&
        s.mapEditor.selectedNode?.nodeType === "ANNOTATION" &&
        s.mapEditor.selectedNode?.annotationType === "POLYGON"
      )
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
