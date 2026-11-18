import { darken, lighten } from "@mui/material/styles";

import { DEFAULT_MESH3D_COLOR } from "./mesh3dConstants.js";
import { rgbDistSq, toRgb } from "./getMesh3dCreationColors.js";
import findAdjacentMeshes3d from "./findAdjacentMeshes3d.js";
import getMesh3dLoops from "./getMesh3dLoops.js";

// « Couleur contrastée » of a multi-selection of mailles: every maille gets a
// shade of ONE base color (the color itself, lighter and darker variations),
// so the set still reads as one family while touching mailles never wear the
// same shade.
const SHADES = [
  (c) => c,
  (c) => lighten(c, 0.4),
  (c) => darken(c, 0.25),
  (c) => lighten(c, 0.65),
];

// The shades of `baseColor`, in preference order.
export function getContrastedShades(baseColor) {
  const base = baseColor || DEFAULT_MESH3D_COLOR;
  return SHADES.map((shade) => {
    try {
      return shade(base);
    } catch {
      return base;
    }
  });
}

// meshes3d: maille rows. Returns a Map id → color.
// Greedy, in number order: a maille starts from the shade of its rank (so
// non-touching mailles vary too) and takes the shade the farthest from the
// ones already given to its ADJACENT mailles (shared border, see
// findAdjacentMeshes3d). `findAdjacent` is injectable for the tests.
export default function getMeshes3dContrastedColors(
  meshes3d,
  baseColor,
  { findAdjacent = defaultFindAdjacent } = {}
) {
  const shades = getContrastedShades(baseColor);
  const rgbs = shades.map(toRgb);
  const n = shades.length;

  const ordered = [...(meshes3d || [])].sort(
    (a, b) => (a.number ?? 0) - (b.number ?? 0)
  );

  const result = new Map();
  const done = [];
  ordered.forEach((mesh3d, rank) => {
    const taken = findAdjacent(mesh3d, done)
      .map((neighbor) => toRgb(result.get(neighbor.id)))
      .filter(Boolean);

    let best = rank % n;
    if (taken.length) {
      let bestScore = -Infinity;
      for (let k = 0; k < n; k++) {
        const i = (rank + k) % n;
        if (!rgbs[i]) continue;
        const score = Math.min(...taken.map((t) => rgbDistSq(rgbs[i], t)));
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
    }
    result.set(mesh3d.id, shades[best]);
    done.push(mesh3d);
  });

  return result;
}

function defaultFindAdjacent(mesh3d, rows) {
  if (!rows.length) return [];
  return findAdjacentMeshes3d(getMesh3dLoops(mesh3d), rows);
}
