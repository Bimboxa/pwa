import { darken, lighten } from "@mui/material/styles";

import { DEFAULT_MESH3D_COLOR } from "./mesh3dConstants.js";
import { rgbDistSq, toRgb } from "./getMesh3dCreationColors.js";

// "Refresh" color of an existing maille: a lighten/darken shade of its base
// color, well-differentiated from the ADJACENT mailles' colors. Unlike the
// creation palette (lighten-only), darken shades widen the room when several
// neighbors crowd the lighten range. Candidates too close to the current
// color are excluded first, so a click always visibly changes the color.
const SHADES = [
  (c) => lighten(c, 0.55),
  (c) => lighten(c, 0.3),
  (c) => lighten(c, 0.7),
  (c) => lighten(c, 0.42),
  (c) => darken(c, 0.12),
  (c) => darken(c, 0.25),
];

// Below this RGB distance, two colors read as "the same shade".
const SAME_COLOR_TOL_SQ = 20 ** 2;

export default function getMesh3dRefreshedColor(
  baseColor,
  currentColor,
  neighborColors = []
) {
  const base = baseColor || DEFAULT_MESH3D_COLOR;

  const candidates = SHADES.map((shade) => {
    try {
      return shade(base);
    } catch {
      return null;
    }
  })
    .map((color) => ({ color, rgb: color ? toRgb(color) : null }))
    .filter((c) => c.rgb);
  if (!candidates.length) return null;

  const current = currentColor ? toRgb(currentColor) : null;
  const kept = current
    ? candidates.filter((c) => rgbDistSq(c.rgb, current) > SAME_COLOR_TOL_SQ)
    : candidates;
  const pool = kept.length ? kept : candidates;

  const taken = (neighborColors || []).map(toRgb).filter(Boolean);
  let best = pool[0];
  if (taken.length) {
    let bestScore = -Infinity;
    for (const c of pool) {
      const score = Math.min(...taken.map((t) => rgbDistSq(c.rgb, t)));
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  } else if (current) {
    // No adjacent maille: still move away from the current color.
    let bestScore = -Infinity;
    for (const c of pool) {
      const score = rgbDistSq(c.rgb, current);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }

  return best.color;
}
