const STORAGE_KEY = "bimboxa-assistantRelay-token";

// Debug (PWA_KEY) pairing key: a device preference entered in
// Configuration > Serveur Chat (or the Chat bar), kept in localStorage and
// mirrored in the assistantRelay slice. Never in the bundle nor IndexedDB.
export function readPairingKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null; // storage unavailable (private mode…)
  }
}

export function writePairingKey(value) {
  const trimmed = (value ?? "").trim();
  try {
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return trimmed || null;
}
