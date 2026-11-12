// Rigid transform of the points of a cut line, in the LOCAL metre frame of
// its host base map group (x / y in the plan, z along its normal) — the
// frame the « Déplacer » / « Tourner » tools work in
// (Features/threedAnnotationMove):
//   - { kind: "MOVE", delta: { x, y, z } }: a translation;
//   - { kind: "ROTATE", pivot: { x, y }, phi }: a turn of `phi` (rad) about
//     the plan normal (local +Z) through the pivot — altitudes unchanged.
// `times`: the transform is applied that many times (copy i of a « copie
// multiple » sits at i × the delta / i × the angle).
// Returns new { x, y, z } points, or null on an unknown transform.
export default function transformCutLinePoints(points, transform, times = 1) {
  if (!Array.isArray(points)) return null;
  if (transform?.kind === "MOVE" && transform.delta) {
    const { x = 0, y = 0, z = 0 } = transform.delta;
    return points.map((p) => ({
      x: p.x + x * times,
      y: p.y + y * times,
      z: p.z + z * times,
    }));
  }
  if (
    transform?.kind === "ROTATE" &&
    transform.pivot &&
    Number.isFinite(transform.phi)
  ) {
    const angle = transform.phi * times;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const { pivot } = transform;
    return points.map((p) => {
      const dx = p.x - pivot.x;
      const dy = p.y - pivot.y;
      return {
        x: pivot.x + dx * cos - dy * sin,
        y: pivot.y + dx * sin + dy * cos,
        z: p.z,
      };
    });
  }
  return null;
}
