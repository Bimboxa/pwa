import { normalizeCircleSegmentation } from "Features/geometry/utils/circleSegmentation";

const LS_KEY = "threedCircleSegmentation";

// { arc, revolution }: chords per full circle of the 3D meshes (device
// preference — see geometry/utils/circleSegmentation).
export function loadCircleSegmentation() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return normalizeCircleSegmentation(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeCircleSegmentation(null);
  }
}

export function storeCircleSegmentation(value) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / unavailable storage
  }
}
