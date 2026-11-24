// Look of the "orthophotos under the cursor" outlines (LayerOrthophotoStations):
// one colour per orthophoto, all variations of ONE base colour (the theme
// secondary), and a line style telling how close the cursor is to the
// camera station.

const HUE_OFFSETS = [0, 16, -16, 32, -32, 8, -24];
// only lighter than the base: the outlines are 1 px wide over photos that
// are mostly dark
const LIGHTNESS_OFFSETS = [0, 18, 32];

function hexToHsl(hex) {
  const clean = String(hex ?? "").replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

// Colour of the orthophoto of rank `index`: the base colour for the first
// one, then hue / lightness variations around it (21 distinct ones, then the
// cycle repeats). Falls back to the base colour when it is not a hex colour.
export function getOrthophotoHoverColor(baseColor, index) {
  const hsl = hexToHsl(baseColor);
  if (!hsl) return baseColor;
  const i = Math.max(0, index | 0);
  const h = (hsl.h + HUE_OFFSETS[i % HUE_OFFSETS.length] + 360) % 360;
  const l = Math.min(
    78,
    Math.max(30, hsl.l + LIGHTNESS_OFFSETS[i % LIGHTNESS_OFFSETS.length])
  );
  return `hsl(${Math.round(h)}, ${Math.round(hsl.s)}%, ${Math.round(l)}%)`;
}

// Line styles, from the closest to the farthest station.
export const HOVER_LINE_STYLES = {
  SOLID: { key: "SOLID", dashArray: "none", borderStyle: "solid" },
  TIGHT: { key: "TIGHT", dashArray: "3 2", borderStyle: "dotted" },
  SPACED: { key: "SPACED", dashArray: "6 6", borderStyle: "dashed" },
};

// `ratio`: distance cursor → station, over the distance station → farthest
// corner of the rectified image (0 = on the station, 1 = at the far corner).
export function getOrthophotoHoverLineStyle(ratio) {
  if (!(ratio > 1 / 3)) return HOVER_LINE_STYLES.SOLID;
  if (ratio <= 2 / 3) return HOVER_LINE_STYLES.TIGHT;
  return HOVER_LINE_STYLES.SPACED;
}
