import {
  DEFAULT_NAVIGATION_PRESET,
  isNavigationPreset,
} from "Features/threedEditor/constants/navigationPresets";

const LS_KEY = "threedNavigationPreset";

export function loadNavigationPreset() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return isNavigationPreset(raw) ? raw : DEFAULT_NAVIGATION_PRESET;
  } catch {
    return DEFAULT_NAVIGATION_PRESET;
  }
}

export function storeNavigationPreset(presetKey) {
  try {
    localStorage.setItem(LS_KEY, presetKey);
  } catch {
    // ignore quota / unavailable storage
  }
}
