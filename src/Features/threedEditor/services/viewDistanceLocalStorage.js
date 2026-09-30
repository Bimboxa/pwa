import {
  VIEW_DISTANCE_AUTO,
  isViewDistance,
} from "Features/threedEditor/constants/viewDistances";

const LS_KEY = "threedMaxViewDistance";

export function loadMaxViewDistance() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === VIEW_DISTANCE_AUTO) return VIEW_DISTANCE_AUTO;
    const value = Number(raw);
    return isViewDistance(value) ? value : VIEW_DISTANCE_AUTO;
  } catch {
    return VIEW_DISTANCE_AUTO;
  }
}

export function storeMaxViewDistance(value) {
  try {
    localStorage.setItem(LS_KEY, String(value));
  } catch {
    // ignore quota / unavailable storage
  }
}
