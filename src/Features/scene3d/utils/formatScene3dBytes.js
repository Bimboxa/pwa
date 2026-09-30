export default function formatScene3dBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Mo";
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} ko`;
  if (bytes < 1e9) return `${Math.round(bytes / 1e6)} Mo`;
  return `${(bytes / 1e9).toFixed(1)} Go`;
}
