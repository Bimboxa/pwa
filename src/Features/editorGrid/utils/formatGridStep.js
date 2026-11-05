// "50 cm", "1 m", "2,5 m" — centimetres under one metre.
export default function formatGridStep(stepM) {
  if (!(stepM > 0)) return "";
  const trim = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
  if (stepM < 1) return `${trim(stepM * 100)} cm`;
  if (stepM >= 1000) return `${trim(stepM / 1000)} km`;
  return `${trim(stepM)} m`;
}
