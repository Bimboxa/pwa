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
