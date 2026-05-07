import { Vector3 } from "three";

// Read the first non-degenerate triangle from the rendered annotation mesh
// and return its normal in world space, as a unit Vector3. Works uniformly
// across POLYGON (the polygon's plane normal), POLYLINE walls (the wall
// segment's outward normal), and OBLIQUE polygons. Returns null if no
// triangle is found.
export default function getAnnotationFaceNormal(annoObject) {
  let result = null;
  annoObject.traverse?.((child) => {
    if (result || !child.isMesh) return;
    const geom = child.geometry;
    const pos = geom?.attributes?.position;
    if (!pos || pos.count < 3) return;

    child.updateWorldMatrix(true, false);

    const indexAttr = geom.index;
    const triCount = indexAttr
      ? Math.floor(indexAttr.count / 3)
      : Math.floor(pos.count / 3);

    for (let t = 0; t < triCount; t++) {
      const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
      const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

      const a = new Vector3(
        pos.getX(i0),
        pos.getY(i0),
        pos.getZ(i0)
      ).applyMatrix4(child.matrixWorld);
      const b = new Vector3(
        pos.getX(i1),
        pos.getY(i1),
        pos.getZ(i1)
      ).applyMatrix4(child.matrixWorld);
      const c = new Vector3(
        pos.getX(i2),
        pos.getY(i2),
        pos.getZ(i2)
      ).applyMatrix4(child.matrixWorld);
      const ab = b.clone().sub(a);
      const ac = c.clone().sub(a);
      const n = ab.cross(ac);
      if (n.lengthSq() > 1e-10) {
        result = n.normalize();
        return;
      }
    }
  });
  return result;
}
