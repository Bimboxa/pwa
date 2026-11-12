import { add, normalize, scale, sub } from "./vec3.js";

// Cut planes of the « Plan de coupe » command: every plane is normal to the
// drawn axis P1 → P2.
//   REPEAT (default): plane i at P1 + i × (P2 - P1), i = 1..count — the
//                     first one through P2, the next ones beyond it.
//   DIVIDE:           plane i at P1 + (i / count) × (P2 - P1) — P1 excluded,
//                     the last one through P2.
//
// Returns [{ point, normal }] (empty when P1 and P2 coincide).
export default function getCutPlaneStations({
  p1,
  p2,
  count = 1,
  mode = "REPEAT",
}) {
  if (!p1 || !p2) return [];
  const axis = sub(p2, p1);
  const normal = normalize(axis);
  if (!normal) return [];
  const n = Math.max(1, Math.floor(count) || 1);
  const stations = [];
  for (let i = 1; i <= n; i++) {
    const t = mode === "DIVIDE" ? i / n : i;
    stations.push({ point: add(p1, scale(axis, t)), normal });
  }
  return stations;
}
