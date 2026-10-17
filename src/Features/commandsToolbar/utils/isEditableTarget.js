// A keydown whose target takes text input must never fire a plain-letter
// command hotkey.
export default function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}
