import { Vector3 } from "three";

import collectAnnotationSectionMeshes from "Features/threedEditor/js/utilsClipping/collectAnnotationSectionMeshes";

// World-space triangle soup of every VISIBLE annotation solid of the scene,
// with the winding normal of each triangle — the input of extendCutLine
// (plane section + walk along the faces). Mailles (ThreedMeshes) and the
// cut lines themselves never enter annotationsObjectsMap, so they are never
// part of the soup. Degenerate triangles are dropped.
//
// Returns [{ a, b, c, n }] with plain {x, y, z} objects (the pure utils
// never see three.js).
export default function collectSceneTriangles(sceneManager) {
  const meshes = collectAnnotationSectionMeshes(
    sceneManager?.annotationsManager,
    { visibleOnly: true }
  );
  const triangles = [];
  const va = new Vector3();
  const vb = new Vector3();
  const vc = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const n = new Vector3();

  const pushTriangle = () => {
    ab.subVectors(vb, va);
    ac.subVectors(vc, va);
    n.crossVectors(ab, ac);
    const len = n.length();
    if (len < 1e-12) return;
    n.divideScalar(len);
    triangles.push({
      a: { x: va.x, y: va.y, z: va.z },
      b: { x: vb.x, y: vb.y, z: vb.z },
      c: { x: vc.x, y: vc.y, z: vc.z },
      n: { x: n.x, y: n.y, z: n.z },
    });
  };

  for (const mesh of meshes) {
    const geom = mesh.geometry;
    const pos = geom?.attributes?.position;
    if (!pos) continue;
    mesh.updateWorldMatrix(true, false);
    const m = mesh.matrixWorld;
    // A mirrored transform flips the winding: keep the normals outward.
    const mirrored = m.determinant() < 0;
    const readWorld = (i, out) =>
      out.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
    const index = geom.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const i0 = index ? index.getX(i) : i;
      const i1 = index ? index.getX(i + 1) : i + 1;
      const i2 = index ? index.getX(i + 2) : i + 2;
      readWorld(i0, va);
      readWorld(mirrored ? i2 : i1, vb);
      readWorld(mirrored ? i1 : i2, vc);
      pushTriangle();
    }
  }
  return triangles;
}
