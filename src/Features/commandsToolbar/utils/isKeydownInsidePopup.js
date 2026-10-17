// A letter typed while a MUI Menu / Popover / Dialog has the focus belongs to
// that popup (MenuList typeahead, dialog fields): the global command hotkeys
// (window listener, capture phase) must not consume it.
export default function isKeydownInsidePopup(e) {
  const target = e?.target;
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(
    target.closest(".MuiPopover-root, .MuiMenu-root, .MuiDialog-root")
  );
}
