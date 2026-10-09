import {
  DEFAULT_AXES_SETTINGS,
  isAxesSettings,
  normalizeAxesYawDeg,
} from "Features/threedEditor/constants/axesDisplay";

const LS_KEY = "threedAxesSettings";

// Device preference of the "Axes" section (3D view settings): gizmo + in-scene
// axes visibility, yaw of the displayed frame. Same pattern as
// navigationPresetLocalStorage.
export function loadAxesSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_AXES_SETTINGS };
    const parsed = { ...DEFAULT_AXES_SETTINGS, ...JSON.parse(raw) };
    if (!isAxesSettings(parsed)) return { ...DEFAULT_AXES_SETTINGS };
    return { ...parsed, yawDeg: normalizeAxesYawDeg(parsed.yawDeg) };
  } catch {
    return { ...DEFAULT_AXES_SETTINGS };
  }
}

export function storeAxesSettings(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / unavailable storage
  }
}
