// Totals of a block from the quantities of its members (getAnnotationQties
// results): {surface, length, membersCount, hasMesh3d}.
// Same rules as the per-template aggregators: developed values win over the
// plan ones, disabled quantities are skipped, and a mesh 3D member has no
// surface / length (flagged, so the UI shows the "3D" marker instead).
// Pure: node-testable.
export const MESH_3D_REASON = "MESH_3D";

export default function sumBlockQties(qtiesList, { mesh3dReason } = {}) {
  const totals = { surface: 0, length: 0, membersCount: 0, hasMesh3d: false };
  for (const qties of qtiesList ?? []) {
    totals.membersCount += 1;
    if (!qties) continue;
    if (mesh3dReason && qties.reason === mesh3dReason) {
      totals.hasMesh3d = true;
      continue;
    }
    if (!qties.enabled) continue;
    const surface = qties.surfaceDeveloped ?? qties.surface;
    const length = qties.lengthDeveloped ?? qties.length;
    if (Number.isFinite(surface)) totals.surface += surface;
    if (Number.isFinite(length)) totals.length += length;
  }
  return totals;
}
