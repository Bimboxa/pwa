import { lighten } from "@mui/material/styles";

import { DEFAULT_MESH3D_COLOR } from "./mesh3dConstants.js";

// Colors of a maille created from an annotation face: the fill keeps the
// annotation's hue but LIGHTER, with a per-number variation so touching
// mailles (consecutive numbers — creation and splits always allocate fresh
// numbers) never look identical; the edges keep the raw annotation color.
// Same bucketing idea as the legacy 2D shadeMeshCellColor.
const SHADES = [
  (c) => lighten(c, 0.55),
  (c) => lighten(c, 0.3),
  (c) => lighten(c, 0.7),
  (c) => lighten(c, 0.42),
];

export default function getMesh3dCreationColors(baseColor, number) {
  const base = baseColor || DEFAULT_MESH3D_COLOR;
  const n = SHADES.length;
  const i = ((Math.abs(Math.round(number ?? 0)) % n) + n) % n;
  let color;
  try {
    color = SHADES[i](base);
  } catch {
    color = base;
  }
  return { color, edgeColor: base };
}
