// Thin wrappers over the browser Fullscreen API (document-level, with the
// WebKit-prefixed fallback of Safari). Both are safe to call anywhere: a
// refused request (no user gesture, iframe policy, unsupported) is swallowed —
// the app's own full screen layout (s.layout.isFullScreen) works without it.

export function isBrowserFullScreen() {
  return Boolean(
    document.fullscreenElement || document.webkitFullscreenElement
  );
}

export function enterBrowserFullScreen() {
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return;
  try {
    const result = request.call(el);
    if (result?.catch) result.catch(() => {});
  } catch {
    // ignored — see above
  }
}

export function exitBrowserFullScreen() {
  if (!isBrowserFullScreen()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit) return;
  try {
    const result = exit.call(document);
    if (result?.catch) result.catch(() => {});
  } catch {
    // ignored
  }
}

// Keyboard Lock API (Chromium only, secure context). While locked, Escape is
// delivered to the page like any other key — the app's own Escape handlers
// (deselect, finish a polyline, quit a tool…) keep working in full screen —
// and the browser only leaves full screen on a long press (~2 s). The lock
// may be requested before the document is full screen: it becomes active as
// soon as it is. Unsupported browsers (Firefox, Safari): no-op, Escape keeps
// leaving the browser full screen there.

export function lockEscapeKey() {
  const kb = navigator.keyboard;
  if (!kb?.lock) return;
  try {
    const result = kb.lock(["Escape"]);
    if (result?.catch) result.catch(() => {});
  } catch {
    // ignored
  }
}

export function unlockEscapeKey() {
  const kb = navigator.keyboard;
  if (!kb?.unlock) return;
  try {
    kb.unlock();
  } catch {
    // ignored
  }
}
