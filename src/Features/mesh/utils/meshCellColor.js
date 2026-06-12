import { darken, lighten } from "@mui/material/styles";

// Per-maille color variation so adjacent cells of the same annotation are
// distinguishable while staying close to the original color. Keyed by the
// cell's LABEL (not its per-segment index) so:
//   - two mailles with the SAME label always get the SAME color;
//   - consecutive M-numbers (M5, M6, M7…) fall in different buckets, so
//     neighbouring mailles — even across two segments — differ.
// Used identically by the Maillage panel, the 2D map editor and the 3D view
// (mesh + label sprite) so a given maille reads the same everywhere.
const SHADES = [
  (c) => c, // base
  (c) => lighten(c, 0.38), // lighter
  (c) => darken(c, 0.3), // darker
];

// Deterministic bucket from a label: its numeric part when present, else a
// string hash. Same label → same bucket.
function labelBucket(label) {
  const s = String(label ?? "");
  const m = /(\d+)/.exec(s);
  if (m) return parseInt(m[1], 10);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function shadeMeshCellColor(baseColor, label) {
  if (!baseColor) return baseColor;
  const n = SHADES.length;
  const i = ((labelBucket(label) % n) + n) % n;
  try {
    return SHADES[i](baseColor);
  } catch {
    return baseColor;
  }
}
