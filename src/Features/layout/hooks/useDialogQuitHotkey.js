import { useEffect } from "react";

import isEditableTarget from "Features/commandsToolbar/utils/isEditableTarget";

// Plain letter (Q by default) closing a full-page dialog (Configuration,
// Raccourcis…) — the hint shown in its « Quitter » button. Capture-phase
// window listener, attached only while `open` (a dialog mounted with
// disableEnforceFocus may leave the focus on body). Yields while typing in a
// field and while a nested MUI dialog (a confirm…) sits on top. Escape stays
// handled by MUI's onClose.
export default function useDialogQuitHotkey(open, onClose, hotkey = "q") {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key?.toLowerCase() !== hotkey.toLowerCase()) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (document.querySelectorAll(".MuiDialog-root").length > 1) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose, hotkey]);
}
