import {useEffect} from "react";

export default function useSaveShortcut(onSave) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const isSaveShortcut =
        (event.metaKey && event.key === "s") ||
        (event.ctrlKey && event.key === "s");

      if (isSaveShortcut) {
        // Always prevent default first
        event.preventDefault();

        // Optionally, avoid triggering save when in input/textarea fields
        const target = event.target;
        const isEditable =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isEditable) {
          onSave();
        }
      }
    };

    // Listen at the *capture* phase so you catch it before it reaches focusable elements
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onSave]);
}
