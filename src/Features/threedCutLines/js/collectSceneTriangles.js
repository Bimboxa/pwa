import { Vector3 } from "three";

import {
  getHalfViewFrame,
  isHalfViewCapTriangle,
  turnAboutHalfViewAxis,
} from "Features/threedEditor/js/utilsAnnotationsManager/revolutionHalfView";
import collectAnnotationSectionMeshes from "Features/threedEditor/js/utilsClipping/collectAnnotationSectionMeshes";

// World-space triangle soup of every VISIBLE annotation solid of the scene,
// with the winding normal of each triangle — the input of extendCutLine
// (plane section + walk along the faces). Mailles (ThreedMeshes) and the
// cut lines themselves never enter annotationsObjectsMap, so they are never
// part of the soup. Degenerate triangles are dropped. A revolution shown as
// a display-only half (« demi-vue ») enters over its full turn: the cut
// lines are those of the real object, whatever the view.
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
  const ta = new Vector3();
  const tb = new Vector3();
  const tc = new Vector3();
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
    const readLocal = (i, out) =>
      out.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const index = geom.index;
    const count = index ? index.count : pos.count;
    // Display-only half revolution: the soup holds the FULL turn (the
    // displayed half + its copy turned 180° about the axis — a rotation, the
    // winding is kept), without the section caps closing the half of a solid.
    const halfView = getHalfViewFrame(mesh);
    for (let i = 0; i + 2 < count; i += 3) {
      const i0 = index ? index.getX(i) : i;
      const i1 = index ? index.getX(i + 1) : i + 1;
      const i2 = index ? index.getX(i + 2) : i + 2;
      readLocal(i0, va);
      readLocal(mirrored ? i2 : i1, vb);
      readLocal(mirrored ? i1 : i2, vc);
      if (halfView) {
        if (isHalfViewCapTriangle(va, vb, vc, halfView)) continue;
        ta.copy(va);
        tb.copy(vb);
        tc.copy(vc);
      }
      va.applyMatrix4(m);
      vb.applyMatrix4(m);
      vc.applyMatrix4(m);
      pushTriangle();
      if (!halfView) continue;
      va.copy(turnAboutHalfViewAxis(ta, halfView.axis)).applyMatrix4(m);
      vb.copy(turnAboutHalfViewAxis(tb, halfView.axis)).applyMatrix4(m);
      vc.copy(turnAboutHalfViewAxis(tc, halfView.axis)).applyMatrix4(m);
      pushTriangle();
    }
  }
  return triangles;
}
