import mergeMesh3dSolids, {
  MERGE_MESH3D_REASONS,
} from "./mergeMesh3dSolids.js";

// Fold of N annotation meshes into one — the mesh mode of « Fusionner les
// annotations ». meshes[0] is the seed; the others are merged into it one by
// one, in an order that works: at each pass the first mesh of the pool that
// touches the running result is absorbed, a mesh that does not touch it YET
// (NOT_TOUCHING) waits for the next pass (selection [A, C, B] with A–B and
// B–C touching but A–C apart succeeds). A pass that absorbs nothing refuses
// the whole merge (NOT_TOUCHING); any other refusal is returned as it is.
//
// mergePair(seed, other) → { ok, mesh } | { ok: false, reason } is
// injectable: the service picks the CSG union for two closed solids whose
// volumes overlap and the planar merge otherwise. Pure by default.
export default function mergeMesh3dMeshes(
  meshes,
  { mergePair = mergeMesh3dSolids } = {}
) {
  const list = (meshes || []).filter((m) => m?.faces?.length);
  if (list.length < 2) {
    return { ok: false, reason: MERGE_MESH3D_REASONS.EMPTY };
  }
  let seed = list[0];
  let pool = list.slice(1);
  while (pool.length) {
    let absorbed = -1;
    for (let i = 0; i < pool.length; i++) {
      const result = mergePair(seed, pool[i]);
      if (result.ok) {
        seed = result.mesh;
        absorbed = i;
        break;
      }
      if (result.reason !== MERGE_MESH3D_REASONS.NOT_TOUCHING) return result;
    }
    if (absorbed < 0) {
      return { ok: false, reason: MERGE_MESH3D_REASONS.NOT_TOUCHING };
    }
    pool = pool.filter((_, i) => i !== absorbed);
  }
  return { ok: true, mesh: seed };
}
