// "46.2 m²" — one decimal, enough for maille surfaces.
export default function formatSurfaceM2(surface) {
  const value = Number.isFinite(surface) ? surface : 0;
  return `${(Math.round(value * 10) / 10).toLocaleString("fr-FR")} m²`;
}
