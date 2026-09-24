// Which vectorization run this TAB follows: { runId, messageId, target }.
// sessionStorage on purpose (like the pairing token): the tab that launched
// the run is the one that creates the base map, so two tabs never race; it
// survives a reload. A run whose tab was closed stays importable by hand
// from the "Assistant IA" panel (its base map job is listed there).
const KEY = "bimboxa-assistantRelay-vectorization";

export function loadVectorizationPointer(sessionId = 0) {
  try {
    const raw = sessionStorage.getItem(pointerKey(sessionId));
    const value = raw ? JSON.parse(raw) : null;
    return value?.runId ? value : null;
  } catch {
    return null;
  }
}

export function saveVectorizationPointer(pointer, sessionId = 0) {
  try {
    if (pointer)
      sessionStorage.setItem(pointerKey(sessionId), JSON.stringify(pointer));
    else sessionStorage.removeItem(pointerKey(sessionId));
  } catch {
    // storage unavailable: the run is simply not resumed after a reload
  }
}

function pointerKey(sessionId) {
  return sessionId === 0 ? KEY : `${KEY}:${sessionId}`;
}

export function loadVectorizationSessionIds() {
  try {
    return Object.keys(sessionStorage)
      .filter((key) => key.startsWith(`${KEY}:`))
      .map((key) => Number(key.slice(KEY.length + 1)))
      .filter(
        (id) =>
          Number.isSafeInteger(id) && id > 0 && loadVectorizationPointer(id)
      )
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}
