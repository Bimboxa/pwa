// Which vectorization run this TAB follows: { runId, messageId, target }.
// sessionStorage on purpose (like the pairing token): the tab that launched
// the run is the one that creates the base map, so two tabs never race; it
// survives a reload. A run whose tab was closed stays importable by hand
// from the "Assistant IA" panel (its base map job is listed there).
const KEY = "bimboxa-assistantRelay-vectorization";

export function loadVectorizationPointer() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value?.runId ? value : null;
  } catch {
    return null;
  }
}

export function saveVectorizationPointer(pointer) {
  try {
    if (pointer) sessionStorage.setItem(KEY, JSON.stringify(pointer));
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the run is simply not resumed after a reload
  }
}
