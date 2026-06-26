import { Vector3, Euler, Quaternion, Matrix4 } from "three";

import getBaseMapTransform, {
  getBaseMapEuler,
  BASE_MAP_ROTATION_ORDER,
} from "Features/baseMaps/js/getBaseMapTransform";
import getClippingPlaneFromSegment from "./getClippingPlaneFromSegment";

// Inverse of getClippingPlaneFromSegment: project the 3D cutting plane back onto
// the baseMap (top view) to get the 2D segment to draw. Used to mirror 3D
// changes (gizmo rotate/translate, flip, axis presets) back to the 2D editor.
//
// The cutting plane (THREE.Plane, world coords) is intersected with the baseMap
// plane; the resulting world line is mapped to image px, clipped to the image
// rectangle, and returned as NORMALIZED [0..1] endpoints + the cut sign.
// Returns null when the plane doesn't cross the image (e.g. parallel).
export default function getSegmentFromClippingPlane({ baseMap, plane }) {
  const imageSize = baseMap?.image?.imageSize;
  const meterByPx = baseMap?.meterByPx;
  if (!imageSize?.width || !meterByPx || !plane) return null;

  const W = imageSize.width;
  const H = imageSize.height;

  // baseMap group world transform
  const t = getBaseMapTransform(baseMap);
  const euler = getBaseMapEuler(t);
  const quaternion = new Quaternion().setFromEuler(
    new Euler(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER)
  );
  const position = new Vector3(t.position.x, t.position.y, t.position.z);
  const matrix = new Matrix4().compose(
    position,
    quaternion,
    new Vector3(1, 1, 1)
  );
  const invMatrix = matrix.clone().invert();

  // baseMap plane (world): normal = group local +Z, passes through group origin
  const n2 = new Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();
  const c2 = n2.dot(position);

  // cutting plane (world): normal·x + constant = 0  →  normal·x = -constant
  const n1 = plane.normal.clone();
  const c1 = -plane.constant;

  // intersection line of the two planes: direction L = n1 × n2
  const L = new Vector3().crossVectors(n1, n2);
  const L2 = L.lengthSq();
  if (L2 < 1e-9) return null; // planes parallel → no cut line on the baseMap

  // a point on both planes:
  // p0 = ( c1 (n2 × L) + c2 (L × n1) ) / |L|²
  const term1 = new Vector3().crossVectors(n2, L).multiplyScalar(c1);
  const term2 = new Vector3().crossVectors(L, n1).multiplyScalar(c2);
  const p0 = term1.add(term2).multiplyScalar(1 / L2);

  // sample two world points on the line, map to image px
  const span = Math.max(W, H) * meterByPx; // generous, only direction matters
  const wa = p0.clone();
  const wb = p0.clone().addScaledVector(L.clone().normalize(), span);

  const worldToPx = (w) => {
    const local = w.clone().applyMatrix4(invMatrix); // (lx, ly, ~0)
    return {
      x: local.x / meterByPx + W / 2,
      y: H / 2 - local.y / meterByPx,
    };
  };
  const q1 = worldToPx(wa);
  const q2 = worldToPx(wb);

  const ends = clipInfiniteLineToRect(q1, q2, W, H);
  if (!ends) return null;

  const pointA = { x: ends[0].x / W, y: ends[0].y / H };
  const pointB = { x: ends[1].x / W, y: ends[1].y / H };

  // recover the cut sign: forward-project these endpoints with sign=+1 and
  // compare the resulting normal to the actual plane normal.
  const test = getClippingPlaneFromSegment({
    baseMap,
    pointA,
    pointB,
    sign: 1,
  });
  const sign = test && test.normal.dot(n1) >= 0 ? 1 : -1;

  return { pointA, pointB, sign };
}

// Clip the infinite line through q1,q2 to the [0,W]×[0,H] rectangle. Returns the
// two border crossing points (farthest apart), or null if it doesn't cross.
function clipInfiniteLineToRect(q1, q2, W, H) {
  const dx = q2.x - q1.x;
  const dy = q2.y - q1.y;
  const eps = 1e-6;
  const cand = [];

  if (Math.abs(dx) > eps) {
    for (const X of [0, W]) {
      const tt = (X - q1.x) / dx;
      const y = q1.y + tt * dy;
      if (y >= -eps && y <= H + eps) cand.push({ x: X, y });
    }
  }
  if (Math.abs(dy) > eps) {
    for (const Y of [0, H]) {
      const tt = (Y - q1.y) / dy;
      const x = q1.x + tt * dx;
      if (x >= -eps && x <= W + eps) cand.push({ x, y: Y });
    }
  }

  const uniq = [];
  for (const p of cand) {
    if (
      !uniq.some(
        (u) => Math.abs(u.x - p.x) < 1e-3 && Math.abs(u.y - p.y) < 1e-3
      )
    ) {
      uniq.push(p);
    }
  }
  if (uniq.length < 2) return null;

  let best = [uniq[0], uniq[1]];
  let bestD = -1;
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      const d = (uniq[i].x - uniq[j].x) ** 2 + (uniq[i].y - uniq[j].y) ** 2;
      if (d > bestD) {
        bestD = d;
        best = [uniq[i], uniq[j]];
      }
    }
  }
  return best;
}
