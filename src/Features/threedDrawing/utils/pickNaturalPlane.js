import { Vector3 } from "three";

// A candidate plane contains a point under this distance (m).
const CONTAIN_EPS_M = 5e-3;
// Two candidates this close in view alignment are a tie.
const TIE_EPS = 1e-6;
// A support normal parallel to a user axis above this |dot| (≈ 5°) carries
// that axis' key.
const PARALLEL_DOT = 0.9962;

// The "natural" drawing plane through `through` for the current view: among
// the planes normal to the user axes (X / Y / Z of the gizmo frame) and, when
// known, the support plane of `through` (its base map plane or the face it
// sits on), the one most facing the camera — the largest |camForward · n|.
//
// Rules:
//   - `mustContain`: points the plane should also pass through (the 2nd
//     vertex when placing the 3rd) — candidates containing them all are
//     preferred, every candidate is considered when none does;
//   - a tie goes to the support plane (a horizontal plan seen from above
//     stays the plan: bounded, image axes, baseMapId).
//
// Returns { normal: Vector3 (unit), axisKey: "X"|"Y"|"Z"|null, isSupport }
// or null without candidates.
export default function pickNaturalPlane(
  camForward,
  { through, userAxes = [], supportNormal = null, mustContain = [] } = {}
) {
  if (!camForward || !through) return null;
  const forward = new Vector3(camForward.x, camForward.y, camForward.z);
  if (forward.lengthSq() < 1e-12) return null;
  forward.normalize();

  const candidates = userAxes
    .map((axis) => ({
      normal: new Vector3(axis.dir.x, axis.dir.y, axis.dir.z).normalize(),
      axisKey: axis.key,
      isSupport: false,
    }))
    .filter((c) => c.normal.lengthSq() > 0.5);
  if (supportNormal) {
    const normal = new Vector3(
      supportNormal.x,
      supportNormal.y,
      supportNormal.z
    );
    if (normal.lengthSq() > 1e-12) {
      normal.normalize();
      const parallel = candidates.find(
        (c) => Math.abs(c.normal.dot(normal)) > PARALLEL_DOT
      );
      candidates.push({
        normal,
        axisKey: parallel?.axisKey ?? null,
        isSupport: true,
      });
    }
  }
  if (!candidates.length) return null;

  const origin = new Vector3(through.x, through.y, through.z);
  const contains = (c) =>
    mustContain.every(
      (p) =>
        Math.abs(new Vector3(p.x, p.y, p.z).sub(origin).dot(c.normal)) <=
        CONTAIN_EPS_M
    );
  let pool = mustContain.length ? candidates.filter(contains) : candidates;
  if (!pool.length) pool = candidates;

  let best = null;
  let bestDot = -1;
  for (const c of pool) {
    const d = Math.abs(forward.dot(c.normal));
    const wins =
      d > bestDot + TIE_EPS ||
      (Math.abs(d - bestDot) <= TIE_EPS && c.isSupport && !best?.isSupport);
    if (wins) {
      best = c;
      bestDot = d;
    }
  }
  return best;
}
