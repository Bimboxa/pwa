// "46.2 m²" — decimals default to 1, enough for maille surfaces. The setting
// is a precision cap: no forced trailing zeros ("4,9 m²", not "4,90 m²").
export default function formatSurfaceM2(surface, decimals = 1) {
  const value = Number.isFinite(surface) ? surface : 0;
  const factor = 10 ** decimals;
  return `${(Math.round(value * factor) / factor).toLocaleString("fr-FR", {
    maximumFractionDigits: decimals,
  })} m²`;
}
