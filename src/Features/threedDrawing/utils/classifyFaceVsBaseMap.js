import { Object3D, Vector3 } from "three";

import getBaseMapTransform, {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "Features/baseMaps/js/getBaseMapTransform";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

const ANGLE_EPS_RAD = (5 * Math.PI) / 180; // 5 degrees
const OFFSET_EPS_M = 5e-3; // 5 mm
const COLLINEAR_EPS = 2e-3; // 0.2% of normalized space — perpendicular footprint test

function computeFaceNormal(vertices) {
  if (vertices.length < 3) return null;
  const a = new Vector3(vertices[0].x, vertices[0].y, vertices[0].z);
  const b = new Vector3(vertices[1].x, vertices[1].y, vertices[1].z);
  const c = new Vector3(vertices[2].x, vertices[2].y, vertices[2].z);
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const n = ab.cross(ac);
  if (n.lengthSq() < 1e-12) return null;
  return n.normalize();
}

// True when all projected 2D points lie on a single straight line (within
// COLLINEAR_EPS in normalized baseMap space). Equivalent geometric test for
// "the 3D face is perpendicular to the baseMap plane" — its footprint
// collapses to a line in the baseMap.
function projectedXYAreCollinear(projected) {
  if (projected.length < 3) return true;
  const a = projected[0];
  let b = null;
  for (let i = 1; i < projected.length; i++) {
    const dx = projected[i].x - a.x;
    const dy = projected[i].y - a.y;
    if (dx * dx + dy * dy > COLLINEAR_EPS * COLLINEAR_EPS) {
      b = projected[i];
      break;
    }
  }
  if (!b) return true; // all points coincide
  const dirX = b.x - a.x;
  const dirY = b.y - a.y;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
  for (const p of projected) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    const cross = Math.abs(px * dirY - py * dirX) / dirLen;
    if (cross > COLLINEAR_EPS) return false;
  }
  return true;
}

function getBaseMapWorldNormal(baseMap) {
  const transform = getBaseMapTransform(baseMap);
  const tmp = new Object3D();
  const euler = getBaseMapEuler(transform);
  tmp.rotation.order = BASE_MAP_ROTATION_ORDER;
  tmp.rotation.set(euler.x, euler.y, euler.z);
  tmp.position.set(
    transform.position.x,
    transform.position.y,
    transform.position.z
  );
  tmp.updateMatrixWorld(true);
  const origin = tmp.localToWorld(new Vector3(0, 0, 0));
  const tip = tmp.localToWorld(new Vector3(0, 0, 1));
  return tip.sub(origin).normalize();
}

// Classify the relationship between a coplanar 3D face and a host baseMap.
// Returns one of:
//   { kind: "PARALLEL", offset, projected }
//   { kind: "PERPENDICULAR", projected } — face plane ⊥ baseMap plane,
//     polyline-along-footprint with per-vertex height (works for ribbons,
//     vertical triangles, vertical N-gons alike)
//   { kind: "OBLIQUE", projected } where projected[i].offset is per-vertex
// `projected` is an array of {x, y, offset} (normalized) — one per input
// vertex, in the same cycle order as the input.
export default function classifyFaceVsBaseMap(vertices, baseMap) {
  if (!vertices?.length || !baseMap) return null;

  const projected = vertices.map((v) => worldToBaseMapNormalized(v, baseMap));
  if (projected.some((p) => !p)) return null;

  const faceNormal = computeFaceNormal(vertices);
  if (!faceNormal) return null;

  const mapNormal = getBaseMapWorldNormal(baseMap);
  const dot = Math.abs(faceNormal.dot(mapNormal));
  const angle = Math.acos(Math.min(1, Math.max(0, dot))); // [0, π/2]

  // PARALLEL: face plane is (anti)parallel to baseMap plane.
  if (angle < ANGLE_EPS_RAD) {
    const offsets = projected.map((p) => p.offset);
    const minO = Math.min(...offsets);
    const maxO = Math.max(...offsets);
    if (maxO - minO < OFFSET_EPS_M) {
      return {
        kind: "PARALLEL",
        offset: (minO + maxO) / 2,
        projected,
      };
    }
  }

  // PERPENDICULAR: the 3D face's 2D projection on the baseMap is a line —
  // equivalent to "face plane ⊥ baseMap plane". Robust to small picking
  // tilts because we test the footprint shape directly rather than the
  // face-normal angle. Renders as a closed POLYLINE walking the cycle with
  // per-vertex offsetTop.
  if (projectedXYAreCollinear(projected)) {
    return {
      kind: "PERPENDICULAR",
      projected,
    };
  }

  return { kind: "OBLIQUE", projected };
}
