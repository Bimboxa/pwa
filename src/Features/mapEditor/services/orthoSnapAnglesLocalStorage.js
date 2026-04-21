const STORAGE_KEY = "orthoSnapAnglesByBaseMap";

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / serialization errors
  }
}

function normalizeAngle(angle) {
  const num = Number(angle);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 10) / 10;
}

function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  const cleaned = list
    .map((v) => normalizeAngle(v))
    .filter((v) => v !== null);
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

export function loadOrthoSnapAngles(baseMapId) {
  if (!baseMapId) return [];
  const store = readStore();
  return sanitizeList(store[baseMapId]);
}

export function saveOrthoSnapAngle(baseMapId, angle) {
  if (!baseMapId) return [];
  const value = normalizeAngle(angle);
  if (value === null) return loadOrthoSnapAngles(baseMapId);

  const store = readStore();
  const current = sanitizeList(store[baseMapId]);
  const next = sanitizeList([...current, value]);
  store[baseMapId] = next;
  writeStore(store);
  return next;
}

export function deleteOrthoSnapAngle(baseMapId, angle) {
  if (!baseMapId) return [];
  const value = normalizeAngle(angle);
  if (value === null) return loadOrthoSnapAngles(baseMapId);

  const store = readStore();
  const current = sanitizeList(store[baseMapId]);
  const next = current.filter((v) => v !== value);
  store[baseMapId] = next;
  writeStore(store);
  return next;
}
