// Runtime of the commands toolbar — the `{ ctx, deps }` pair every command
// reads in getState / run / Button — published by the mounted CommandsToolbar
// (the only owner of useCommandsContext) so a UI living outside the toolbar
// can show and fire a command without mounting a second context (a second
// useAnnotationsV2): the « Commande » block of an info (Features/comments).
// Null while no toolbar is mounted (Viewer module, capture framing…): the
// commands are then unavailable, like their toolbar buttons.
// Read it in React with hooks/useCommandsRuntime.

let runtime = null;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

// `owner`: token of the publishing toolbar instance (see clearCommandsRuntime).
export function setCommandsRuntime({ ctx, deps, owner }) {
  runtime = { ctx, deps, owner };
  emit();
}

// Called by a toolbar on unmount: only clears its own runtime (another
// instance may have published meanwhile — the toolbar remounts when its dock
// changes).
export function clearCommandsRuntime(owner) {
  if (runtime?.owner !== owner) return;
  runtime = null;
  emit();
}

export function getCommandsRuntime() {
  return runtime;
}

export function subscribeCommandsRuntime(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
