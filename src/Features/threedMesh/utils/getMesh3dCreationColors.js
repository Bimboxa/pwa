import { decomposeColor, lighten } from "@mui/material/styles";

import { DEFAULT_MESH3D_COLOR } from "./mesh3dConstants.js";

// Colors of a maille created from an annotation face: the fill keeps the
// annotation's hue but LIGHTER, with a per-number variation so touching
// mailles (consecutive numbers — creation and splits always allocate fresh
// numbers) never look identical; the edges keep the raw annotation color.
// When the colors of the ADJACENT mailles are provided, the shade (from the
// same base-color palette) with the strongest contrast against them wins —
// the number bucket is only the starting preference / tie-break order.
const SHADES = [
  (c) => lighten(c, 0.55),
  (c) => lighten(c, 0.3),
  (c) => lighten(c, 0.7),
  (c) => lighten(c, 0.42),
];

function toRgb(color) {
  try {
    const { values } = decomposeColor(color);
    return values;
  } catch {
    return null;
  }
}

const rgbDistSq = (c1, c2) =>
  (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2;

export default function getMesh3dCreationColors(
  baseColor,
  number,
  neighborColors = []
) {
  const base = baseColor || DEFAULT_MESH3D_COLOR;
  const candidates = SHADES.map((shade) => {
    try {
      return shade(base);
    } catch {
      return base;
    }
  });
  const n = candidates.length;
  const start = ((Math.abs(Math.round(number ?? 0)) % n) + n) % n;

  let color = candidates[start];
  const taken = (neighborColors || []).map(toRgb).filter(Boolean);
  if (taken.length) {
    const rgbs = candidates.map(toRgb);

    // "Sufficient" contrast = half the closest palette-shade spacing: a
    // neighbor of another hue never conflicts, a neighbor wearing (or close
    // to) the same shade does.
    let minPairSq = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (!rgbs[i] || !rgbs[j]) continue;
        minPairSq = Math.min(minPairSq, rgbDistSq(rgbs[i], rgbs[j]));
      }
    }
    const thresholdSq = Number.isFinite(minPairSq) ? minPairSq / 4 : 0;

    let fallback = null;
    let fallbackScore = -Infinity;
    let found = false;
    for (let k = 0; k < n && !found; k++) {
      const i = (start + k) % n;
      if (!rgbs[i]) continue;
      const score = Math.min(...taken.map((t) => rgbDistSq(rgbs[i], t)));
      if (score > thresholdSq) {
        color = candidates[i];
        found = true;
      } else if (score > fallbackScore) {
        fallbackScore = score;
        fallback = candidates[i];
      }
    }
    // Every shade conflicts (4+ same-palette neighbors): least-bad one.
    if (!found && fallback) color = fallback;
  }

  return { color, edgeColor: base };
}
