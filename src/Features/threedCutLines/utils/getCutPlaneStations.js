import { add, length, normalize, scale, sub } from "./vec3.js";

// Most planes a « distance entre plans » run creates (same cap as the typed
// count, MAX_CUT_PLANES of cutPlaneBuffer).
const MAX_STEP_PLANES = 99;
// Two planes closer than this (metres) are the same plane.
const STATION_EPS_M = 1e-6;

// Cut planes of the « Plan de coupe » command: every plane is normal to the
// drawn axis P1 → P2.
//   REPEAT (default): plane i at P1 + i × (P2 - P1), i = 1..count — the
//                     first one through P2, the next ones beyond it.
//   DIVIDE:           plane i at P1 + (i / count) × (P2 - P1) — P1 excluded,
//                     the last one through P2.
//   STEP (stepM > 0, wins over count / mode): one plane every `stepM`
//                     metres from P1, strictly between P1 and P2. With
//                     `includeEnds`, one more plane through P1 and one
//                     through P2 — the last interval is shorter when |P1P2|
//                     is not a multiple of the step.
//
// Returns [{ point, normal }] (empty when P1 and P2 coincide).
export default function getCutPlaneStations({
  p1,
  p2,
  count = 1,
  mode = "REPEAT",
  stepM = null,
  includeEnds = true,
}) {
  if (!p1 || !p2) return [];
  const axis = sub(p2, p1);
  const normal = normalize(axis);
  if (!normal) return [];
  const stations = [];
  if (stepM > 0) {
    const axisLength = length(axis);
    if (includeEnds) stations.push({ point: p1, normal });
    for (let i = 1; i <= MAX_STEP_PLANES; i++) {
      const d = i * stepM;
      if (d >= axisLength - STATION_EPS_M) break;
      stations.push({ point: add(p1, scale(normal, d)), normal });
    }
    if (includeEnds) stations.push({ point: p2, normal });
    return stations;
  }
  const n = Math.max(1, Math.floor(count) || 1);
  for (let i = 1; i <= n; i++) {
    const t = mode === "DIVIDE" ? i / n : i;
    stations.push({ point: add(p1, scale(axis, t)), normal });
  }
  return stations;
}

// Vertices of the dimension chain (« Afficher les cotes ») along the axis:
// P1, every plane, and the axis end P2 when no plane lies on or beyond it —
// ordered from P1, coincident points merged.
export function getCutPlaneAxisPoints({ p1, p2, stations }) {
  if (!p1 || !p2) return [];
  const axis = sub(p2, p1);
  const normal = normalize(axis);
  if (!normal) return [];
  const entries = [p1, p2, ...(stations || []).map((s) => s.point)].map(
    (point) => ({
      point,
      d:
        (point.x - p1.x) * normal.x +
        (point.y - p1.y) * normal.y +
        (point.z - p1.z) * normal.z,
    })
  );
  entries.sort((a, b) => a.d - b.d);
  const points = [];
  let lastD = null;
  for (const entry of entries) {
    if (lastD !== null && entry.d - lastD < STATION_EPS_M) continue;
    points.push(entry.point);
    lastD = entry.d;
  }
  return points;
}
